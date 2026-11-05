import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const skillSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 50 },
  category: { type: String, default: 'Other Skills', trim: true },
  level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], default: 'Beginner' }
});

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String, required: true, select: false },
  phone: { type: String, default: '', trim: true },
  profilePicture: { type: String, default: '' },
  bio: { type: String, default: '', maxlength: 300 },
  department: { type: String, default: '', maxlength: 80 },
  year: { type: String, default: '', maxlength: 30 },
  location: { type: String, default: '', maxlength: 80 },
  experienceLevel: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], default: 'Beginner' },
  showEmail: { type: Boolean, default: false },
  showPhone: { type: Boolean, default: false },
  skillsKnown: { type: [skillSchema], default: [] },
  skillsLearning: { type: [skillSchema], default: [] }
}, { timestamps: true });

const connectionSchema = new Schema({
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  // A sorted pair key prevents duplicate requests in either direction.
  pairKey: { type: String, required: true, unique: true },
  status: { type: String, enum: ['Pending', 'Accepted', 'Rejected'], default: 'Pending', index: true }
}, { timestamps: true });

const exchangeSchema = new Schema({
  requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  receiverId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  offeredSkill: { type: String, required: true, trim: true },
  requestedSkill: { type: String, required: true, trim: true },
  message: { type: String, default: '', maxlength: 500 },
  status: { type: String, enum: ['Pending', 'Accepted', 'Rejected', 'Cancelled', 'Completed'], default: 'Pending', index: true }
}, { timestamps: true });

const notificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  relatedRequestId: { type: Schema.Types.ObjectId }
}, { timestamps: true });

// Reuse registered models during local reloads and serverless warm starts.
export const User = mongoose.models.User || model('User', userSchema);
export const Connection = mongoose.models.Connection || model('Connection', connectionSchema);
export const Exchange = mongoose.models.Exchange || model('Exchange', exchangeSchema);
export const Notification = mongoose.models.Notification || model('Notification', notificationSchema);
