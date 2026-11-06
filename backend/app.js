import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { connectDatabase } from './db.js';
import { User, Connection, Exchange, Notification, ChatMessage } from './models.js';

const app = express();
app.use(cors());
// The larger limit allows a small PDF to be sent as base64 JSON.
app.use(express.json({ limit: '12mb' }));

// Connect on demand so the same app works locally and on Render.
app.use('/api', async (_req, res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (error) {
    console.error('Database connection failed:', error.message);
    res.status(503).json({ message: 'The database is not available. Check MONGODB_URI.' });
  }
});

const categories = ['Programming', 'Web Development', 'Data Science', 'Designing', 'Communication', 'Other Skills'];
const levels = ['Beginner', 'Intermediate', 'Advanced'];

function tokenFor(user) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is missing.');
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function publicUser(user, owner = false) {
  const result = user.toObject ? user.toObject() : { ...user };
  delete result.password;
  if (!owner && !result.showEmail) delete result.email;
  if (!owner && !result.showPhone) delete result.phone;
  delete result.showEmail;
  delete result.showPhone;
  return result;
}

function auth(required = true) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token && !required) return next();
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.id;
      next();
    } catch {
      return res.status(401).json({ message: 'Please sign in to continue.' });
    }
  };
}

function cleanSkills(value = []) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => typeof item === 'string' ? { name: item.trim() } : item)
    .filter((item) => item?.name?.trim())
    .slice(0, 30)
    .map((item) => ({
      name: String(item.name).trim().slice(0, 50),
      category: categories.includes(item.category) ? item.category : 'Other Skills',
      level: levels.includes(item.level) ? item.level : 'Beginner'
    }));
}

async function notify(userId, senderId, type, message, relatedRequestId) {
  await Notification.create({ userId, senderId, type, message, relatedRequestId });
}

function validId(id) {
  return mongoose.isValidObjectId(id);
}

const maxChatPdfBytes = 8 * 1024 * 1024;

async function canChat(firstId, secondId) {
  const pairKey = [String(firstId), String(secondId)].sort().join(':');
  return Connection.exists({ pairKey, status: 'Accepted' });
}

function chatMessageView(message) {
  return {
    _id: message._id,
    senderId: message.senderId,
    receiverId: message.receiverId,
    text: message.text,
    pdf: message.pdfName ? { name: message.pdfName, size: message.pdfSize } : null,
    createdAt: message.createdAt
  };
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'SkillSwap API' }));

// Create an account and keep only a salted password hash in MongoDB.
app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { name, email, phone, password, confirmPassword } = req.body;
    if (!name?.trim() || !email?.trim() || !password || !phone?.trim()) {
      return res.status(400).json({ message: 'Name, email, phone, and password are required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (password.length < 8) return res.status(400).json({ message: 'Use a password with at least 8 characters.' });
    if (confirmPassword !== undefined && password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match.' });
    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ message: 'An account with this email already exists.' });
    const user = await User.create({ name: name.trim(), email: normalizedEmail, phone: phone.trim(), password: await bcrypt.hash(password, 12) });
    res.status(201).json({ token: tokenFor(user), user: publicUser(user, true) });
  } catch (error) { next(error); }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const user = await User.findOne({ email: String(req.body.email || '').trim().toLowerCase() }).select('+password');
    if (!user || !(await bcrypt.compare(req.body.password || '', user.password))) {
      return res.status(401).json({ message: 'Email or password is not correct.' });
    }
    res.json({ token: tokenFor(user), user: publicUser(user, true) });
  } catch (error) { next(error); }
});

app.get('/api/auth/me', auth(), async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'Account not found.' });
    res.json({ user: publicUser(user, true) });
  } catch (error) { next(error); }
});

app.get('/api/users/profile', auth(), async (req, res, next) => {
  try { res.json({ user: publicUser(await User.findById(req.userId), true) }); }
  catch (error) { next(error); }
});

app.put('/api/users/profile', auth(), async (req, res, next) => {
  try {
    const allowed = ['name', 'phone', 'profilePicture', 'bio', 'department', 'year', 'location', 'experienceLevel', 'showEmail', 'showPhone'];
    const update = {};
    for (const key of allowed) if (req.body[key] !== undefined) update[key] = req.body[key];
    if (req.body.skillsKnown !== undefined) update.skillsKnown = cleanSkills(req.body.skillsKnown);
    if (req.body.skillsLearning !== undefined) update.skillsLearning = cleanSkills(req.body.skillsLearning);
    const user = await User.findByIdAndUpdate(req.userId, update, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ message: 'Account not found.' });
    res.json({ user: publicUser(user, true) });
  } catch (error) { next(error); }
});

app.get('/api/users/search', auth(), async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 80);
    const query = { _id: { $ne: req.userId } };
    const category = categories.includes(req.query.category) ? req.query.category : '';
    const level = levels.includes(req.query.level) ? req.query.level : '';
    if (q) query['skillsKnown.name'] = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    if (category) query['skillsKnown.category'] = category;
    if (level) query.experienceLevel = level;
    const users = await User.find(query).sort({ createdAt: -1 }).limit(60);
    res.json({ users: users.map((user) => publicUser(user)) });
  } catch (error) { next(error); }
});

app.get('/api/users/:id', auth(), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: 'This profile link is not valid.' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Student not found.' });
    res.json({ user: publicUser(user, String(user._id) === String(req.userId)) });
  } catch (error) { next(error); }
});

// The skills routes offer direct add, list, update, and remove operations.
app.get('/api/skills', auth(), async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('skillsKnown skillsLearning');
    res.json({ skillsKnown: user.skillsKnown, skillsLearning: user.skillsLearning });
  } catch (error) { next(error); }
});
app.post('/api/skills', auth(), async (req, res, next) => {
  try {
    const field = req.body.type === 'learning' ? 'skillsLearning' : 'skillsKnown';
    const user = await User.findById(req.userId);
    user[field] = cleanSkills([...user[field], req.body.skill]);
    await user.save();
    res.status(201).json({ skills: user[field] });
  } catch (error) { next(error); }
});
app.put('/api/skills/:id', auth(), async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    const field = req.body.type === 'learning' ? 'skillsLearning' : 'skillsKnown';
    const skill = user[field].id(req.params.id);
    if (!skill) return res.status(404).json({ message: 'Skill not found.' });
    Object.assign(skill, cleanSkills([req.body.skill])[0] || {});
    await user.save();
    res.json({ skills: user[field] });
  } catch (error) { next(error); }
});
app.delete('/api/skills/:id', auth(), async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    const field = req.query.type === 'learning' ? 'skillsLearning' : 'skillsKnown';
    user[field] = user[field].filter((skill) => String(skill._id) !== req.params.id);
    await user.save();
    res.json({ skills: user[field] });
  } catch (error) { next(error); }
});

app.post('/api/connections', auth(), async (req, res, next) => {
  try {
    const receiverId = String(req.body.receiverId || '');
    if (!validId(receiverId) || receiverId === String(req.userId)) return res.status(400).json({ message: 'Choose another student to connect with.' });
    if (!await User.exists({ _id: receiverId })) return res.status(404).json({ message: 'Student not found.' });
    const pairKey = [String(req.userId), receiverId].sort().join(':');
    const previous = await Connection.findOne({ pairKey });
    if (previous && previous.status !== 'Rejected') return res.status(409).json({ message: 'A connection request already exists.' });
    if (previous) await previous.deleteOne();
    const connection = await Connection.create({ senderId: req.userId, receiverId, pairKey });
    const sender = await User.findById(req.userId).select('name');
    await notify(receiverId, req.userId, 'connection', `${sender.name} sent you a connection request.`, connection._id);
    res.status(201).json({ connection });
  } catch (error) { next(error); }
});

app.get('/api/connections/friends', auth(), async (req, res, next) => {
  try {
    const rows = await Connection.find({ status: 'Accepted', $or: [{ senderId: req.userId }, { receiverId: req.userId }] }).sort({ updatedAt: -1 });
    const ids = rows.map((row) => String(row.senderId) === String(req.userId) ? row.receiverId : row.senderId);
    const users = await User.find({ _id: { $in: ids } });
    res.json({ users: users.map((user) => publicUser(user)) });
  } catch (error) { next(error); }
});
app.get('/api/connections/received', auth(), async (req, res, next) => {
  try {
    const rows = await Connection.find({ receiverId: req.userId, status: 'Pending' }).populate('senderId', 'name profilePicture bio skillsKnown skillsLearning experienceLevel');
    res.json({ requests: rows });
  } catch (error) { next(error); }
});
app.get('/api/connections/sent', auth(), async (req, res, next) => {
  try {
    const rows = await Connection.find({ senderId: req.userId, status: 'Pending' }).populate('receiverId', 'name profilePicture bio skillsKnown skillsLearning experienceLevel');
    res.json({ requests: rows });
  } catch (error) { next(error); }
});
app.get('/api/connections/status/:id', auth(), async (req, res, next) => {
  try {
    const pairKey = [String(req.userId), String(req.params.id)].sort().join(':');
    const connection = await Connection.findOne({ pairKey });
    res.json({ status: connection?.status || 'None', sentByMe: connection ? String(connection.senderId) === String(req.userId) : false });
  } catch (error) { next(error); }
});

async function updateConnection(req, res, next, status) {
  try {
    const row = await Connection.findOne({ _id: req.params.id, receiverId: req.userId, status: 'Pending' });
    if (!row) return res.status(404).json({ message: 'Pending request not found.' });
    row.status = status;
    await row.save();
    const actor = await User.findById(req.userId).select('name');
    await notify(row.senderId, req.userId, 'connection_update', `${actor.name} ${status.toLowerCase()} your connection request.`, row._id);
    res.json({ connection: row });
  } catch (error) { next(error); }
}
app.put('/api/connections/:id/accept', auth(), (req, res, next) => updateConnection(req, res, next, 'Accepted'));
app.put('/api/connections/:id/reject', auth(), (req, res, next) => updateConnection(req, res, next, 'Rejected'));
app.delete('/api/connections/:id', auth(), async (req, res, next) => {
  try {
    const row = await Connection.findOne({ _id: req.params.id, $or: [{ senderId: req.userId }, { receiverId: req.userId }] });
    if (!row) return res.status(404).json({ message: 'Connection was not found.' });
    if (row.status === 'Pending' && String(row.receiverId) === String(req.userId)) return res.status(403).json({ message: 'Only the sender can cancel a pending request.' });
    await row.deleteOne();
    res.json({ message: 'Connection removed.' });
  } catch (error) { next(error); }
});
app.delete('/api/connections/user/:id', auth(), async (req, res, next) => {
  try {
    const pairKey = [String(req.userId), String(req.params.id)].sort().join(':');
    const row = await Connection.findOneAndDelete({ pairKey, status: 'Accepted' });
    if (!row) return res.status(404).json({ message: 'Connection was not found.' });
    res.json({ message: 'Connection removed.' });
  } catch (error) { next(error); }
});

// Chat history is available only to students whose connection request was accepted.
app.get('/api/chats', auth(), async (req, res, next) => {
  try {
    const connections = await Connection.find({
      status: 'Accepted',
      $or: [{ senderId: req.userId }, { receiverId: req.userId }]
    }).sort({ updatedAt: -1 });
    const friendIds = connections.map((row) => String(row.senderId) === String(req.userId) ? row.receiverId : row.senderId);
    const friends = await User.find({ _id: { $in: friendIds } });

    // Load message previews only; PDF bytes are sent when a user downloads a file.
    const history = await ChatMessage.find({
      $or: [{ senderId: req.userId }, { receiverId: req.userId }],
      hiddenFor: { $ne: req.userId }
    }).sort({ createdAt: -1 }).select('senderId receiverId text pdfName createdAt').lean();
    const latestByFriend = new Map();
    for (const message of history) {
      const otherId = String(message.senderId) === String(req.userId) ? String(message.receiverId) : String(message.senderId);
      if (!latestByFriend.has(otherId)) latestByFriend.set(otherId, message);
    }

    const results = friends.map((friend) => {
      const latest = latestByFriend.get(String(friend._id));
      return {
        ...publicUser(friend),
        lastMessage: latest ? (latest.text || (latest.pdfName ? `PDF: ${latest.pdfName}` : '')) : '',
        lastMessageAt: latest?.createdAt || null
      };
    }).sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
    res.json({ friends: results });
  } catch (error) { next(error); }
});

app.get('/api/chats/:userId/messages', auth(), async (req, res, next) => {
  try {
    const otherId = String(req.params.userId);
    if (!validId(otherId) || otherId === String(req.userId)) return res.status(400).json({ message: 'Choose a valid student to chat with.' });
    if (!await canChat(req.userId, otherId)) return res.status(403).json({ message: 'Chat is available after the connection is accepted.' });
    const messages = await ChatMessage.find({
      $or: [
        { senderId: req.userId, receiverId: otherId },
        { senderId: otherId, receiverId: req.userId }
      ],
      hiddenFor: { $ne: req.userId }
    }).sort({ createdAt: 1 }).select('-pdfData').lean();
    res.json({ messages: messages.map(chatMessageView) });
  } catch (error) { next(error); }
});

app.post('/api/chats/:userId/messages', auth(), async (req, res, next) => {
  try {
    const otherId = String(req.params.userId);
    if (!validId(otherId) || otherId === String(req.userId)) return res.status(400).json({ message: 'Choose a valid student to chat with.' });
    if (!await canChat(req.userId, otherId)) return res.status(403).json({ message: 'Chat is available after the connection is accepted.' });

    const text = String(req.body.text || '').trim();
    if (text.length > 5000) return res.status(400).json({ message: 'A message can have up to 5,000 characters.' });
    let pdfData;
    let pdfName = '';
    let pdfSize = 0;

    if (req.body.pdf) {
      const rawBase64 = String(req.body.pdf.base64 || '').replace(/^data:application\/pdf;base64,/i, '');
      pdfName = String(req.body.pdf.name || 'shared-document.pdf').replace(/[\\/\r\n"]/g, '_').trim().slice(0, 120);
      if (!pdfName.toLowerCase().endsWith('.pdf')) return res.status(400).json({ message: 'Please choose a PDF file.' });
      if (!rawBase64 || rawBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(rawBase64)) {
        return res.status(400).json({ message: 'The selected PDF could not be read. Please choose it again.' });
      }
      pdfData = Buffer.from(rawBase64, 'base64');
      if (pdfData.length > maxChatPdfBytes) return res.status(413).json({ message: 'PDF files must be 8 MB or smaller.' });
      if (pdfData.length < 5 || pdfData.subarray(0, 5).toString('ascii') !== '%PDF-') {
        return res.status(400).json({ message: 'The selected file does not look like a PDF.' });
      }
      pdfSize = pdfData.length;
    }
    if (!text && !pdfData) return res.status(400).json({ message: 'Write a message or attach a PDF before sending.' });

    const message = await ChatMessage.create({ senderId: req.userId, receiverId: otherId, text, pdfName, pdfSize, pdfData });
    res.status(201).json({ message: chatMessageView(message) });
  } catch (error) { next(error); }
});

app.get('/api/chats/:userId/files/:messageId', auth(), async (req, res, next) => {
  try {
    const otherId = String(req.params.userId);
    if (!validId(otherId) || !validId(req.params.messageId)) return res.status(400).json({ message: 'This chat file link is not valid.' });
    if (!await canChat(req.userId, otherId)) return res.status(403).json({ message: 'This chat is no longer available.' });
    const message = await ChatMessage.findOne({
      _id: req.params.messageId,
      $or: [
        { senderId: req.userId, receiverId: otherId },
        { senderId: otherId, receiverId: req.userId }
      ],
      hiddenFor: { $ne: req.userId }
    }).select('+pdfData');
    if (!message?.pdfData) return res.status(404).json({ message: 'This PDF is no longer available.' });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="shared-document.pdf"',
      'Content-Length': message.pdfData.length,
      'Cache-Control': 'private, no-store'
    });
    res.send(message.pdfData);
  } catch (error) { next(error); }
});

app.delete('/api/chats/:userId/messages/:messageId', auth(), async (req, res, next) => {
  try {
    const otherId = String(req.params.userId);
    if (!validId(otherId) || !validId(req.params.messageId)) return res.status(400).json({ message: 'This chat message link is not valid.' });
    if (!await canChat(req.userId, otherId)) return res.status(403).json({ message: 'This chat is no longer available.' });
    const message = await ChatMessage.findOneAndUpdate({
      _id: req.params.messageId,
      $or: [
        { senderId: req.userId, receiverId: otherId },
        { senderId: otherId, receiverId: req.userId }
      ],
      hiddenFor: { $ne: req.userId }
    }, { $addToSet: { hiddenFor: req.userId } }, { new: true });
    if (!message) return res.status(404).json({ message: 'This message was not found.' });
    res.json({ message: 'Message deleted from your chat.' });
  } catch (error) { next(error); }
});

app.delete('/api/chats/:userId', auth(), async (req, res, next) => {
  try {
    const otherId = String(req.params.userId);
    if (!validId(otherId) || otherId === String(req.userId)) return res.status(400).json({ message: 'Choose a valid chat.' });
    if (!await canChat(req.userId, otherId)) return res.status(403).json({ message: 'This chat is no longer available.' });
    await ChatMessage.updateMany({
      $or: [
        { senderId: req.userId, receiverId: otherId },
        { senderId: otherId, receiverId: req.userId }
      ],
      hiddenFor: { $ne: req.userId }
    }, { $addToSet: { hiddenFor: req.userId } });
    res.json({ message: 'Chat history cleared from your view.' });
  } catch (error) { next(error); }
});

app.post('/api/exchanges', auth(), async (req, res, next) => {
  try {
    const { receiverId, offeredSkill, requestedSkill, message = '' } = req.body;
    if (!validId(receiverId) || receiverId === String(req.userId)) return res.status(400).json({ message: 'Choose another student for an exchange.' });
    const [sender, receiver] = await Promise.all([User.findById(req.userId), User.findById(receiverId)]);
    if (!receiver) return res.status(404).json({ message: 'Student not found.' });
    const has = (list, skill) => list.some((item) => item.name.toLowerCase() === String(skill || '').trim().toLowerCase());
    if (!has(sender.skillsKnown, offeredSkill) || !has(receiver.skillsLearning, offeredSkill)) return res.status(400).json({ message: 'The skill you offer must be one you know and the other student wants to learn.' });
    if (!has(receiver.skillsKnown, requestedSkill) || !has(sender.skillsLearning, requestedSkill)) return res.status(400).json({ message: 'The skill you want must be one the other student knows and you want to learn.' });
    const duplicate = await Exchange.exists({ requesterId: req.userId, receiverId, status: 'Pending' });
    if (duplicate) return res.status(409).json({ message: 'You already have a pending exchange request with this student.' });
    const exchange = await Exchange.create({ requesterId: req.userId, receiverId, offeredSkill, requestedSkill, message: String(message).slice(0, 500) });
    await notify(receiverId, req.userId, 'exchange', `${sender.name} sent you a skill exchange request.`, exchange._id);
    res.status(201).json({ exchange });
  } catch (error) { next(error); }
});
app.get('/api/exchanges/sent', auth(), async (req, res, next) => {
  try { res.json({ exchanges: await Exchange.find({ requesterId: req.userId }).populate('receiverId', 'name profilePicture') }); }
  catch (error) { next(error); }
});
app.get('/api/exchanges/received', auth(), async (req, res, next) => {
  try { res.json({ exchanges: await Exchange.find({ receiverId: req.userId }).populate('requesterId', 'name profilePicture') }); }
  catch (error) { next(error); }
});
app.put('/api/exchanges/:id/status', auth(), async (req, res, next) => {
  try {
    const exchange = await Exchange.findById(req.params.id);
    if (!exchange) return res.status(404).json({ message: 'Exchange not found.' });
    const action = req.body.status;
    const receiver = String(exchange.receiverId) === String(req.userId);
    const participant = receiver || String(exchange.requesterId) === String(req.userId);
    if (!participant) return res.status(403).json({ message: 'You cannot update this exchange.' });
    if (['Accepted', 'Rejected'].includes(action) && (!receiver || exchange.status !== 'Pending')) return res.status(403).json({ message: 'Only the receiver can answer a pending request.' });
    if (action === 'Completed' && exchange.status !== 'Accepted') return res.status(400).json({ message: 'Accept this exchange before marking it complete.' });
    if (!['Accepted', 'Rejected', 'Completed'].includes(action)) return res.status(400).json({ message: 'Choose a valid exchange status.' });
    exchange.status = action;
    await exchange.save();
    const actor = await User.findById(req.userId).select('name');
    const otherId = receiver ? exchange.requesterId : exchange.receiverId;
    await notify(otherId, req.userId, 'exchange_update', `${actor.name} ${action.toLowerCase()} your skill exchange.`, exchange._id);
    res.json({ exchange });
  } catch (error) { next(error); }
});
app.delete('/api/exchanges/:id', auth(), async (req, res, next) => {
  try {
    const exchange = await Exchange.findOne({ _id: req.params.id, requesterId: req.userId, status: 'Pending' });
    if (!exchange) return res.status(404).json({ message: 'Pending sent request not found.' });
    exchange.status = 'Cancelled';
    await exchange.save();
    res.json({ exchange });
  } catch (error) { next(error); }
});

app.get('/api/notifications', auth(), async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(100).populate('senderId', 'name profilePicture');
    res.json({ notifications, unreadCount: await Notification.countDocuments({ userId: req.userId, isRead: false }) });
  } catch (error) { next(error); }
});
app.put('/api/notifications/:id/read', auth(), async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, { isRead: true }, { new: true });
    if (!notification) return res.status(404).json({ message: 'Notification not found.' });
    res.json({ notification });
  } catch (error) { next(error); }
});

app.get('/api/dashboard/stats', auth(), async (req, res, next) => {
  try {
    const [user, friends, receivedConnections, sentExchanges, receivedExchanges] = await Promise.all([
      User.findById(req.userId).select('skillsKnown skillsLearning'),
      Connection.countDocuments({ status: 'Accepted', $or: [{ senderId: req.userId }, { receiverId: req.userId }] }),
      Connection.countDocuments({ status: 'Pending', $or: [{ senderId: req.userId }, { receiverId: req.userId }] }),
      Exchange.find({ requesterId: req.userId }),
      Exchange.find({ receiverId: req.userId })
    ]);
    const allExchanges = [...sentExchanges, ...receivedExchanges];
    res.json({ stats: {
      skillsOffered: user.skillsKnown.length,
      skillsLearning: user.skillsLearning.length,
      friends,
      pendingConnections: receivedConnections,
      pendingExchanges: allExchanges.filter((item) => item.status === 'Pending').length,
      acceptedExchanges: allExchanges.filter((item) => item.status === 'Accepted').length,
      completedExchanges: allExchanges.filter((item) => item.status === 'Completed').length
    } });
  } catch (error) { next(error); }
});

// Give the browser a readable error for invalid input and unexpected failures.
app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.code === 11000) return res.status(409).json({ message: 'This record already exists.' });
  if (error.name === 'CastError') return res.status(400).json({ message: 'One of the saved IDs is not valid.' });
  if (error.name === 'ValidationError') return res.status(400).json({ message: error.message });
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

export default app;
