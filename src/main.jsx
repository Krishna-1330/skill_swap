import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Bell, BookOpen, Check, ChevronDown, Compass, FileText, GraduationCap, Handshake, Home, LogOut, Menu, MessageCircle, Search, Send, Settings, Sparkles, Trash2, Users, X } from 'lucide-react';
import api, { messageFrom } from './api.js';
import './styles.css';
import './chat.css';

const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('skillswap-token')));
  useEffect(() => {
    if (!localStorage.getItem('skillswap-token')) return;
    api.get('/auth/me').then(({ data }) => setUser(data.user)).catch(() => localStorage.removeItem('skillswap-token')).finally(() => setLoading(false));
  }, []);
  const value = useMemo(() => ({ user, setUser, loading, signOut: () => { localStorage.removeItem('skillswap-token'); setUser(null); } }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" />Loading your space…</div>;
  return user ? children : <Navigate to="/signin" replace />;
}

const navItems = [
  ['/app', Home, 'Home'], ['/discover', Compass, 'Discover'], ['/friends', Users, 'Friends'], ['/chats', MessageCircle, 'Chats'], ['/requests', Handshake, 'Requests'], ['/exchanges', BookOpen, 'Exchanges'], ['/notifications', Bell, 'Notifications']
];

function Avatar({ user, size = 'normal' }) {
  const name = user?.name || 'Student';
  if (user?.profilePicture) return <img className={`avatar ${size}`} src={user.profilePicture} alt={`${name}'s profile`} />;
  return <div className={`avatar avatar-letter ${size}`} aria-label={name}>{name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div>;
}

function Topbar({ onMenu }) {
  const { user, signOut } = useAuth();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const submit = (event) => { event.preventDefault(); navigate(`/search?q=${encodeURIComponent(query.trim())}`); };
  return <header className="topbar">
    <button className="icon-button mobile-menu" onClick={onMenu} aria-label="Open menu"><Menu size={20} /></button>
    <Link className="brand" to="/app"><span className="brand-mark"><Sparkles size={19} /></span><span>skill<span>swap</span></span></Link>
    <form className="top-search" onSubmit={submit}><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find people by a skill…" aria-label="Search skills" /><kbd>↵</kbd></form>
    <div className="top-actions">
      <Link className="quick-link" to="/notifications" aria-label="Notifications"><Bell size={19} /></Link>
      <button className="profile-menu" onClick={() => setOpen(!open)}><Avatar user={user} size="small" /><span className="profile-name">{user?.name?.split(' ')[0]}</span><ChevronDown size={15} /></button>
      {open && <div className="dropdown"><Link to={`/profile/${user?._id}`} onClick={() => setOpen(false)}><Users size={16} /> My profile</Link><Link to="/edit-profile" onClick={() => setOpen(false)}><Settings size={16} /> Edit profile</Link><button onClick={signOut}><LogOut size={16} /> Sign out</button></div>}
    </div>
  </header>;
}

function Sidebar({ active, close }) {
  const [unread, setUnread] = useState(0);
  useEffect(() => { api.get('/notifications').then(({ data }) => setUnread(data.unreadCount)).catch(() => {}); }, []);
  return <aside className="sidebar">
    <div className="side-label">YOUR SPACE</div>
    <nav>{navItems.map(([path, Icon, label]) => <Link key={path} to={path} onClick={close} className={`nav-link ${active === path ? 'active' : ''}`}><Icon size={18} /><span>{label}</span>{label === 'Notifications' && unread > 0 && <b className="nav-count">{unread}</b>}</Link>)}</nav>
    <div className="side-card"><div className="side-card-icon"><GraduationCap size={19} /></div><b>Learn by sharing</b><p>Everyone has something valuable to teach.</p><Link to="/discover">Find your match <ArrowRight size={14} /></Link></div>
    <div className="side-foot">A little knowledge goes a long way.<span>Made for curious minds ✦</span></div>
  </aside>;
}

function Layout({ active, children }) {
  const [menu, setMenu] = useState(false);
  return <div className="app-shell"><Topbar onMenu={() => setMenu(!menu)} /><div className="app-frame"><div className={`sidebar-wrap ${menu ? 'show' : ''}`}><Sidebar active={active} close={() => setMenu(false)} /></div>{menu && <button className="scrim" onClick={() => setMenu(false)} aria-label="Close menu" />}<main className="main-content">{children}</main></div></div>;
}

function PageTitle({ eyebrow, title, subtitle, action }) { return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div>; }
function Notice({ error, success }) { if (!error && !success) return null; return <div className={`notice ${error ? 'error' : 'success'}`}>{error || success}</div>; }
function Empty({ icon: Icon = Sparkles, title, children }) { return <div className="empty-state"><div><Icon size={22} /></div><h3>{title}</h3><p>{children}</p></div>; }
function SkillTags({ skills = [], tone = '' }) { return <div className="skill-tags">{skills.length ? skills.slice(0, 5).map((s) => <span className={`skill-tag ${tone}`} key={s.name}>{s.name}</span>) : <span className="muted-small">Not added yet</span>}</div>; }
function Status({ value }) { return <span className={`status status-${String(value).toLowerCase()}`}>{value}</span>; }

function UserCard({ person, onRemove }) {
  const [status, setStatus] = useState('None');
  const [sentByMe, setSentByMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => { api.get(`/connections/status/${person._id}`).then(({ data }) => { setStatus(data.status); setSentByMe(data.sentByMe); }).catch(() => {}); }, [person._id]);
  const connect = async () => {
    setBusy(true); setNotice('');
    try { await api.post('/connections', { receiverId: person._id }); setStatus('Pending'); }
    catch (e) { setNotice(messageFrom(e)); }
    finally { setBusy(false); }
  };
  return <article className="person-card">
    <div className="person-top"><Avatar user={person} /><div className="person-info"><Link to={`/profile/${person._id}`} className="person-name">{person.name}</Link><span>{person.department || 'Student'}{person.year ? ` · ${person.year}` : ''}</span></div><Link to={`/profile/${person._id}`} className="subtle-icon" aria-label={`View ${person.name}'s profile`}><ArrowRight size={17} /></Link></div>
    <p className="person-bio">{person.bio || 'Here to share what I know and learn something new.'}</p>
    <div className="skill-block"><label>CAN TEACH</label><SkillTags skills={person.skillsKnown} /></div>
    <div className="skill-block"><label>WANTS TO LEARN</label><SkillTags skills={person.skillsLearning} tone="learn" /></div>
    {notice && <div className="inline-error">{notice}</div>}
    <div className="person-actions"><Link className="button button-light button-small" to={`/profile/${person._id}`}>View profile</Link>{status === 'Accepted' && <Link className="button button-light button-small" to={`/chats/${person._id}`}><MessageCircle size={13} /> Chat</Link>}{onRemove ? <button className="button button-light button-small" onClick={() => onRemove(person)}>Remove</button> : status === 'None' || status === 'Rejected' ? <button className="button button-primary button-small" onClick={connect} disabled={busy}>{busy ? 'Sending…' : status === 'Rejected' ? 'Connect again' : 'Connect'}</button> : <button className="button button-muted button-small" disabled>{status === 'Accepted' ? 'Connected' : status === 'Pending' ? sentByMe ? 'Request sent' : 'Request received' : status}</button>}</div>
  </article>;
}

function Landing() {
  const { user } = useAuth();
  return <div className="landing"><header className="landing-nav"><Link className="brand" to="/"><span className="brand-mark"><Sparkles size={19} /></span><span>skill<span>swap</span></span></Link><div><Link className="landing-login" to="/signin">Sign in</Link><Link className="button button-primary" to="/signup">Join SkillSwap <ArrowRight size={15} /></Link></div></header>
    <section className="hero"><div className="hero-copy"><div className="hero-chip"><span /> A community built on sharing</div><h1>What you know can<br />change <em>someone’s day.</em></h1><p>Meet students with different skills, teach what you love, and learn something new together. No money. Just good people and shared knowledge.</p><div className="hero-actions"><Link to={user ? '/app' : '/signup'} className="button button-primary button-large">Start swapping <ArrowRight size={17} /></Link><Link to="/signin" className="hero-secondary">I already have an account</Link></div><div className="hero-proof"><div className="proof-avatars"><span>A</span><span>M</span><span>J</span><span>+</span></div><div><b>Learn with people like you</b><small>Every student has something to share.</small></div></div></div><div className="hero-art"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="hero-spark hero-spark-a">✦</div><div className="hero-spark hero-spark-b">✧</div><div className="swap-illustration"><div className="illu-top"><div className="illu-badge"><Sparkles size={14} /> SKILL EXCHANGE</div><h3>Better together.</h3><p>One skill shared. One new skill learned.</p></div><div className="exchange-visual"><div className="mini-person person-purple"><span>R</span><small>React</small></div><div className="swap-arrows"><ArrowRight size={17} /><ArrowRight size={17} className="arrow-back" /></div><div className="mini-person person-blue"><span>S</span><small>Spanish</small></div></div><div className="illu-foot"><span><i /> Learning together</span><span>01 / 03</span></div></div><div className="float-note note-top"><span className="note-emoji">🎨</span><div><b>Design for everyone</b><small>Share what you know</small></div><Check size={17} /></div><div className="float-note note-bottom"><span className="note-emoji">💻</span><div><b>Python to React</b><small>A perfect skill match</small></div><span className="match-pill">MATCH</span></div></div></section>
    <section className="how-section"><div className="center-heading"><div className="eyebrow">GOOD THINGS HAPPEN WHEN WE SHARE</div><h2>Learning is better <em>together.</em></h2><p>SkillSwap makes it easy to turn what you know into what someone else needs.</p></div><div className="steps"><div><span>01</span><h3>Show what you know</h3><p>Add the skills you can teach and what you’re hoping to learn.</p></div><div><span>02</span><h3>Find your people</h3><p>Search by skill and meet students who are a great match.</p></div><div><span>03</span><h3>Swap and grow</h3><p>Make a connection, agree on an exchange, and learn together.</p></div></div></section>
    <footer className="landing-footer"><Link className="brand" to="/"><span className="brand-mark"><Sparkles size={17} /></span><span>skill<span>swap</span></span></Link><span>A little knowledge goes a long way.</span><Link to="/signup">Join the community <ArrowRight size={14} /></Link></footer>
  </div>;
}

function AuthPage({ mode }) {
  const signup = mode === 'signup';
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (user) navigate('/app'); }, [user, navigate]);
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const { data } = await api.post(`/auth/${signup ? 'register' : 'login'}`, form);
      localStorage.setItem('skillswap-token', data.token); setUser(data.user); navigate('/app');
    } catch (e) { setError(messageFrom(e)); }
    finally { setBusy(false); }
  };
  return <div className="auth-page"><Link className="brand auth-brand" to="/"><span className="brand-mark"><Sparkles size={18} /></span><span>skill<span>swap</span></span></Link><div className="auth-layout"><div className="auth-welcome"><div className="hero-chip"><span /> A community built on sharing</div><h1>{signup ? <>Bring your skills.<br />Leave with more.</> : <>Welcome back<br />to your <em>community.</em></>}</h1><p>Good things happen when we learn from each other. Find your people and start a skill exchange.</p><div className="auth-note"><div className="auth-note-icon"><Handshake size={19} /></div><div><b>A fair exchange, every time</b><span>Teach one thing. Learn something new.</span></div></div><div className="auth-decoration">✳ <span>↗</span> ✦</div></div><div className="auth-card"><div className="auth-card-heading"><div className="eyebrow">{signup ? 'YOUR NEXT CHAPTER STARTS HERE' : 'GOOD TO SEE YOU AGAIN'}</div><h2>{signup ? 'Create your account' : 'Sign in to SkillSwap'}</h2><p>{signup ? 'A few details and you’re on your way.' : 'Pick up where you left off.'}</p></div><Notice error={error} /><form onSubmit={submit} className="form-stack">{signup && <><label>Full name<input name="name" value={form.name} onChange={change} placeholder="e.g. Jordan Lee" required maxLength="80" /></label><label>Email address<input type="email" name="email" value={form.email} onChange={change} placeholder="you@college.edu" required /></label><label>Phone number<input type="tel" name="phone" value={form.phone} onChange={change} placeholder="Your phone number" required /></label></>}{!signup && <label>Email address<input type="email" name="email" value={form.email} onChange={change} placeholder="you@college.edu" required /></label>}<label>Password<input type="password" name="password" value={form.password} onChange={change} placeholder={signup ? 'At least 8 characters' : 'Your password'} minLength="8" required /></label>{signup && <label>Confirm password<input type="password" name="confirmPassword" value={form.confirmPassword} onChange={change} placeholder="Type your password again" minLength="8" required /></label>}<button className="button button-primary button-full button-large" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></button></form><div className="auth-switch">{signup ? 'Already have an account?' : 'New to SkillSwap?'} <Link to={signup ? '/signin' : '/signup'}>{signup ? 'Sign in' : 'Create an account'}</Link></div><div className="privacy-note">🔒 Your contact details stay private unless you choose to share them.</div></div></div><div className="auth-bottom"><span>© 2025 SkillSwap</span><span>Learning is better together. <Sparkles size={13} /></span></div></div>;
}

function categorize(name) {
  const value = name.toLowerCase();
  if (/react|html|css|javascript|typescript|node|web|frontend|backend/.test(value)) return 'Web Development';
  if (/python|java|c\+\+|programming|c#|rust|go lang/.test(value)) return 'Programming';
  if (/data|machine learning|ai|statistics|sql|analytics/.test(value)) return 'Data Science';
  if (/design|figma|illustration|photoshop|ui|ux/.test(value)) return 'Designing';
  if (/communication|writing|speaking|language|english|spanish/.test(value)) return 'Communication';
  return 'Other Skills';
}
function parseSkills(text) { return [...new Set(text.split(',').map((name) => name.trim()).filter(Boolean))].slice(0, 30).map((name) => ({ name, category: categorize(name) })); }

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [people, setPeople] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { Promise.all([api.get('/dashboard/stats'), api.get('/users/search')]).then(([a, b]) => { setStats(a.data.stats); setPeople(b.data.users.slice(0, 3)); }).catch((e) => setError(messageFrom(e))); }, []);
  const cards = stats ? [[Sparkles, stats.skillsOffered, 'Skills to share', 'violet'], [BookOpen, stats.skillsLearning, 'Skills to learn', 'blue'], [Users, stats.friends, 'Connections', 'green'], [Handshake, stats.pendingConnections, 'Connection requests', 'orange'], [Handshake, stats.pendingExchanges, 'Pending exchanges', 'orange'], [Check, stats.acceptedExchanges, 'Active exchanges', 'blue'], [Check, stats.completedExchanges, 'Completed exchanges', 'green']] : [];
  return <Layout active="/app"><div className="welcome-banner"><div className="welcome-copy"><div className="eyebrow">YOUR LEARNING SPACE</div><h1>Good morning, {user?.name?.split(' ')[0]} <span>✦</span></h1><p>Every skill you share can open a new door. What will you learn today?</p><div className="welcome-links"><Link className="button button-primary" to="/discover">Find a skill match <ArrowRight size={15} /></Link><Link className="welcome-text-link" to="/edit-profile">Update your skills <ArrowRight size={14} /></Link></div></div><div className="welcome-art"><div className="welcome-orb orb-a" /><div className="welcome-orb orb-b" /><div className="welcome-book"><BookOpen size={35} /></div><span className="spark s1">✦</span><span className="spark s2">✧</span></div></div>
    <Notice error={error} />
    <div className="section-heading"><div><h2>Your progress</h2><p>Small exchanges make a big difference.</p></div><Link to="/exchanges" className="text-link">See exchanges <ArrowRight size={14} /></Link></div>
    <div className="stats-grid">{cards.map(([Icon, value, label, color]) => <div className={`stat-card ${color}`} key={label}><div className="stat-icon"><Icon size={19} /></div><strong>{value}</strong><span>{label}</span></div>)}</div>
    <div className="dashboard-columns"><section className="content-panel"><div className="section-heading"><div><h2>People you may like</h2><p>Students who have skills to share</p></div><Link to="/discover" className="text-link">See all <ArrowRight size={14} /></Link></div>{people.length ? <div className="people-grid compact">{people.map((person) => <UserCard person={person} key={person._id} />)}</div> : <Empty title="Your community is waiting">Add some skills to your profile to help people find you.</Empty>}</section><section className="content-panel getting-started"><div className="section-heading"><div><h2>Getting started</h2><p>Make your profile easy to find.</p></div><div className="tiny-spark"><Sparkles size={18} /></div></div><div className="check-row done"><span><Check size={15} /></span><div><b>Create your account</b><small>You’re part of the community.</small></div></div><Link className="check-row" to="/edit-profile"><span>2</span><div><b>Add your skills</b><small>Tell people what you can teach.</small></div><ArrowRight size={15} /></Link><Link className="check-row" to="/discover"><span>3</span><div><b>Make a connection</b><small>Find someone to learn with.</small></div><ArrowRight size={15} /></Link></section></div>
  </Layout>;
}

const categoryOptions = ['All skills', 'Programming', 'Web Development', 'Data Science', 'Designing', 'Communication', 'Other Skills'];
function SearchPeople() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const category = params.get('category') || 'All skills';
  const level = params.get('level') || 'All levels';
  const [people, setPeople] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { setLoading(true); setError(''); api.get('/users/search', { params: { q, category: category === 'All skills' ? '' : category, level: level === 'All levels' ? '' : level } }).then(({ data }) => setPeople(data.users)).catch((e) => setError(messageFrom(e))).finally(() => setLoading(false)); }, [q, category, level]);
  return <Layout active="/discover"><PageTitle eyebrow="FIND YOUR PEOPLE" title={q ? `People who know ${q}` : 'Discover students'} subtitle="Find someone who can teach what you want to learn, and share something you know." action={<Link className="button button-light" to="/edit-profile"><Settings size={15} /> Add your skills</Link>} />
    <form className="discover-search" onSubmit={(e) => { e.preventDefault(); setParams({ q, category, level }); }}><Search size={20} /><input aria-label="Search by skill" placeholder="Try Python, React, design…" value={q} onChange={(e) => setParams((prev) => { const next = new URLSearchParams(prev); if (e.target.value) next.set('q', e.target.value); else next.delete('q'); return next; })} /><span className="search-hint">Search by skill</span></form>
    <div className="filters"><div className="filter-chips">{categoryOptions.map((item) => <button key={item} className={`filter-chip ${category === item ? 'selected' : ''}`} onClick={() => setParams((prev) => { const next = new URLSearchParams(prev); if (item === 'All skills') next.delete('category'); else next.set('category', item); return next; })}>{item}</button>)}</div><select aria-label="Filter by experience" value={level} onChange={(e) => setParams((prev) => { const next = new URLSearchParams(prev); if (e.target.value === 'All levels') next.delete('level'); else next.set('level', e.target.value); return next; })}><option>All levels</option><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></div>
    <div className="results-heading"><b>{loading ? 'Looking for matches…' : `${people.length} ${people.length === 1 ? 'student' : 'students'} found`}</b><span>Results match skills they can teach</span></div><Notice error={error} />{loading ? <div className="loading-line"><div className="spinner" /> Finding your people…</div> : people.length ? <div className="people-grid">{people.map((person) => <UserCard key={person._id} person={person} />)}</div> : <Empty icon={Search} title="No students found yet">Try a different skill or clear a filter. New people join all the time.</Empty>}
  </Layout>;
}

function Profile({ own = false }) {
  const { user: me } = useAuth(); const { id } = useParamsCompat();
  const [person, setPerson] = useState(null); const [status, setStatus] = useState('None'); const [sentByMe, setSentByMe] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [exchangeOpen, setExchangeOpen] = useState(false); const [exchange, setExchange] = useState({ offeredSkill: '', requestedSkill: '', message: '' }); const [success, setSuccess] = useState('');
  const profileId = own ? me?._id : id;
  useEffect(() => { if (!profileId) return; api.get(`/users/${profileId}`).then(({ data }) => setPerson(data.user)).catch((e) => setError(messageFrom(e))); if (!own) api.get(`/connections/status/${profileId}`).then(({ data }) => { setStatus(data.status); setSentByMe(data.sentByMe); }).catch(() => {}); }, [profileId, own]);
  if (!person) return <Layout><Notice error={error} /><div className="loading-line"><div className="spinner" /> Loading profile…</div></Layout>;
  const sendConnection = async () => { setBusy(true); setError(''); try { await api.post('/connections', { receiverId: person._id }); setStatus('Pending'); setSentByMe(true); } catch (e) { setError(messageFrom(e)); } finally { setBusy(false); } };
  const sendExchange = async (e) => { e.preventDefault(); setBusy(true); setError(''); try { await api.post('/exchanges', { receiverId: person._id, ...exchange }); setSuccess('Your skill exchange request was sent.'); setExchangeOpen(false); } catch (e) { setError(messageFrom(e)); } finally { setBusy(false); } };
  const matchingOffers = (me?.skillsKnown || []).filter((skill) => (person.skillsLearning || []).some((want) => want.name.toLowerCase() === skill.name.toLowerCase()));
  const matchingRequests = (person.skillsKnown || []).filter((skill) => (me?.skillsLearning || []).some((want) => want.name.toLowerCase() === skill.name.toLowerCase()));
  return <Layout><div className="profile-cover"><div className="cover-dots" /><div className="cover-sun" /></div><section className="profile-card"><div className="profile-main"><Avatar user={person} size="large" /><div className="profile-headline"><div className="eyebrow">STUDENT PROFILE</div><h1>{person.name}</h1><p>{[person.department, person.year, person.location].filter(Boolean).join(' · ') || 'SkillSwap community member'}</p></div>{own ? <Link to="/edit-profile" className="button button-light"><Settings size={15} /> Edit profile</Link> : <div className="profile-actions">{status === 'None' || status === 'Rejected' ? <button className="button button-primary" disabled={busy} onClick={sendConnection}>{busy ? 'Sending…' : status === 'Rejected' ? 'Connect again' : 'Connect'} <Users size={15} /></button> : <span className="button button-muted">{status === 'Accepted' ? 'Connected' : status === 'Pending' ? (sentByMe ? 'Request sent' : 'Request received') : status}</span>}{matchingOffers.length && matchingRequests.length ? <button className="button button-light" onClick={() => setExchangeOpen(!exchangeOpen)}><Handshake size={15} /> Propose an exchange</button> : null}</div>}</div><Notice error={error} success={success} />{!own && (person.email || person.phone) && <p className="contact-line">{[person.email && `Email: ${person.email}`, person.phone && `Phone: ${person.phone}`].filter(Boolean).join(' · ')}</p>}{person.bio && <p className="profile-bio">{person.bio}</p>}<div className="profile-sections"><div className="profile-section"><div className="section-icon violet"><Sparkles size={18} /></div><div><h3>Skills I can share</h3><p>Things {person.name.split(' ')[0]} can teach you.</p><SkillTags skills={person.skillsKnown} /></div></div><div className="profile-section"><div className="section-icon blue"><BookOpen size={18} /></div><div><h3>Skills I want to learn</h3><p>Things {person.name.split(' ')[0]} is learning.</p><SkillTags skills={person.skillsLearning} tone="learn" /></div></div></div>{exchangeOpen && <form className="exchange-form" onSubmit={sendExchange}><div className="section-heading"><div><h2>Suggest a skill swap</h2><p>Choose skills that work for both of you.</p></div><button type="button" className="subtle-icon" onClick={() => setExchangeOpen(false)} aria-label="Close"><X size={18} /></button></div><div className="form-row"><label>I can teach<select required value={exchange.offeredSkill} onChange={(e) => setExchange({ ...exchange, offeredSkill: e.target.value })}><option value="">Choose a skill</option>{matchingOffers.map((s) => <option key={s.name}>{s.name}</option>)}</select></label><label>I want to learn<select required value={exchange.requestedSkill} onChange={(e) => setExchange({ ...exchange, requestedSkill: e.target.value })}><option value="">Choose a skill</option>{matchingRequests.map((s) => <option key={s.name}>{s.name}</option>)}</select></label></div><label>Short message<textarea maxLength="500" rows="3" placeholder="Hi! I’d love to swap skills…" value={exchange.message} onChange={(e) => setExchange({ ...exchange, message: e.target.value })} /></label><button className="button button-primary" disabled={busy}>{busy ? 'Sending…' : 'Send exchange request'} <ArrowRight size={15} /></button></form>}</section></Layout>;
}

function useParamsCompat() { return useParams(); }

function EditProfile() {
  const { user, setUser } = useAuth(); const navigate = useNavigate();
  const [form, setForm] = useState({}); const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (user) setForm({ ...user, skillsKnownText: (user.skillsKnown || []).map((s) => s.name).join(', '), skillsLearningText: (user.skillsLearning || []).map((s) => s.name).join(', ') }); }, [user]);
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => { e.preventDefault(); setBusy(true); setError(''); setSuccess(''); try { const payload = { ...form, skillsKnown: parseSkills(form.skillsKnownText || ''), skillsLearning: parseSkills(form.skillsLearningText || '') }; const { data } = await api.put('/users/profile', payload); setUser(data.user); setSuccess('Your profile has been saved.'); } catch (e) { setError(messageFrom(e)); } finally { setBusy(false); } };
  return <Layout><PageTitle eyebrow="MAKE IT YOURS" title="Edit your profile" subtitle="Help other students see what you can share and what you’d like to learn." /><form className="edit-card form-stack" onSubmit={submit}><div className="section-heading"><div><h2>Your details</h2><p>Contact details are private unless you choose to share them.</p></div></div><div className="form-row"><label>Full name<input name="name" value={form.name || ''} onChange={change} required maxLength="80" /></label><label>Phone number<input name="phone" value={form.phone || ''} onChange={change} /></label></div><label>Profile picture URL<input name="profilePicture" value={form.profilePicture || ''} onChange={change} placeholder="https://…" /><small>Paste a public image link. You can leave this blank.</small></label><label>Short bio<textarea name="bio" value={form.bio || ''} onChange={change} maxLength="300" rows="3" placeholder="A few words about you…" /></label><div className="form-row"><label>Department<input name="department" value={form.department || ''} onChange={change} placeholder="e.g. Computer Science" /></label><label>Year of study<input name="year" value={form.year || ''} onChange={change} placeholder="e.g. Year 2" /></label></div><div className="form-row"><label>Location<input name="location" value={form.location || ''} onChange={change} placeholder="City or campus" /></label><label>Experience level<select name="experienceLevel" value={form.experienceLevel || 'Beginner'} onChange={change}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label></div><div className="form-divider" /><label>Skills I can teach <span className="field-hint">Separate each skill with a comma.</span><input name="skillsKnownText" value={form.skillsKnownText || ''} onChange={change} placeholder="Python, Figma, Public speaking" /></label><label>Skills I want to learn <span className="field-hint">Separate each skill with a comma.</span><input name="skillsLearningText" value={form.skillsLearningText || ''} onChange={change} placeholder="React, Data analysis, Spanish" /></label><div className="privacy-options"><b>Contact privacy</b><label className="check-label"><input type="checkbox" name="showEmail" checked={Boolean(form.showEmail)} onChange={change} /> Show my email on my public profile</label><label className="check-label"><input type="checkbox" name="showPhone" checked={Boolean(form.showPhone)} onChange={change} /> Show my phone number on my public profile</label></div><Notice error={error} success={success} /><div className="form-actions"><button type="button" className="button button-light" onClick={() => navigate(-1)}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'} <Check size={15} /></button></div></form></Layout>;
}

function Friends() {
  const [friends, setFriends] = useState([]); const [query, setQuery] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(true);
  const reload = () => api.get('/connections/friends').then(({ data }) => setFriends(data.users)).catch((e) => setError(messageFrom(e))).finally(() => setBusy(false));
  useEffect(() => { reload(); }, []);
  const remove = async (friend) => { if (!window.confirm(`Remove ${friend.name} from your connections?`)) return; try { await api.delete(`/connections/user/${friend._id}`); await reload(); } catch (e) { setError(messageFrom(e)); } };
  const filtered = friends.filter((friend) => friend.name.toLowerCase().includes(query.toLowerCase()) || friend.skillsKnown?.some((skill) => skill.name.toLowerCase().includes(query.toLowerCase())));
  return <Layout active="/friends"><PageTitle eyebrow="YOUR COMMUNITY" title="Your connections" subtitle="People you’ve connected with on SkillSwap." /><div className="discover-search slim"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your connections…" /></div><Notice error={error} />{busy ? <div className="loading-line"><div className="spinner" /> Loading connections…</div> : filtered.length ? <div className="people-grid">{filtered.map((person) => <UserCard key={person._id} person={person} onRemove={remove} />)}</div> : <Empty icon={Users} title={query ? 'No connections match' : 'Your story starts with a hello'}>{query ? 'Try searching a different name or skill.' : 'Find a student with a skill you want to learn and send them a connection request.'} <Link to="/discover" className="inline-link">Discover students <ArrowRight size={14} /></Link></Empty>}</Layout>;
}

function ConnectionRequests() {
  const [received, setReceived] = useState([]); const [sent, setSent] = useState([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(true);
  const reload = () => Promise.all([api.get('/connections/received'), api.get('/connections/sent')]).then(([a, b]) => { setReceived(a.data.requests); setSent(b.data.requests); }).catch((e) => setError(messageFrom(e))).finally(() => setBusy(false));
  useEffect(() => { reload(); }, []);
  const answer = async (id, action) => { try { await api.put(`/connections/${id}/${action}`); reload(); } catch (e) { setError(messageFrom(e)); } };
  const cancel = async (id) => { try { await api.delete(`/connections/${id}`); reload(); } catch (e) { setError(messageFrom(e)); } };
  return <Layout active="/requests"><PageTitle eyebrow="SAY HELLO" title="Connection requests" subtitle="Accept a request to make a new learning connection." /><Notice error={error} />{busy ? <div className="loading-line"><div className="spinner" /> Loading requests…</div> : <div className="request-columns"><section className="content-panel"><div className="section-heading"><div><h2>Received</h2><p>{received.length} waiting for your reply</p></div></div>{received.length ? received.map((row) => <div className="request-row" key={row._id}><Avatar user={row.senderId} /><div className="request-details"><Link to={`/profile/${row.senderId._id}`} className="person-name">{row.senderId.name}</Link><span>Would like to connect with you</span><SkillTags skills={row.senderId.skillsKnown || []} /></div><div className="request-buttons"><button className="button button-primary button-small" onClick={() => answer(row._id, 'accept')}>Accept</button><button className="button button-light button-small" onClick={() => answer(row._id, 'reject')}>Decline</button></div></div>) : <Empty icon={Users} title="All caught up">New connection requests will show up here.</Empty>}</section><section className="content-panel"><div className="section-heading"><div><h2>Sent</h2><p>Requests you’re waiting on</p></div></div>{sent.length ? sent.map((row) => <div className="request-row" key={row._id}><Avatar user={row.receiverId} /><div className="request-details"><Link to={`/profile/${row.receiverId._id}`} className="person-name">{row.receiverId.name}</Link><span>Request sent · waiting for a reply</span></div><button className="button button-light button-small" onClick={() => cancel(row._id)}>Cancel</button></div>) : <Empty icon={Handshake} title="No open requests">You’ll see sent requests here.</Empty>}</section></div>}</Layout>;
}

function Exchanges() {
  const [sent, setSent] = useState([]); const [received, setReceived] = useState([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(true);
  const reload = () => Promise.all([api.get('/exchanges/sent'), api.get('/exchanges/received')]).then(([a, b]) => { setSent(a.data.exchanges); setReceived(b.data.exchanges); }).catch((e) => setError(messageFrom(e))).finally(() => setBusy(false));
  useEffect(() => { reload(); }, []);
  const action = async (id, status) => { try { await api.put(`/exchanges/${id}/status`, { status }); reload(); } catch (e) { setError(messageFrom(e)); } };
  const cancel = async (id) => { try { await api.delete(`/exchanges/${id}`); reload(); } catch (e) { setError(messageFrom(e)); } };
  const card = (item, incoming) => { const person = incoming ? item.requesterId : item.receiverId; return <article className="exchange-card" key={item._id}><div className="exchange-person"><Avatar user={person} size="small" /><div><Link to={`/profile/${person?._id}`} className="person-name">{person?.name || 'Student'}</Link><small>{incoming ? 'wants to swap skills with you' : 'your skill exchange request'}</small></div><Status value={item.status} /></div><div className="swap-summary"><div><small>{incoming ? 'THEY CAN TEACH' : 'YOU CAN TEACH'}</small><b>{incoming ? item.offeredSkill : item.offeredSkill}</b></div><ArrowRight size={18} /><div><small>{incoming ? 'THEY WANT TO LEARN' : 'YOU WANT TO LEARN'}</small><b>{item.requestedSkill}</b></div></div>{item.message && <p className="exchange-message">“{item.message}”</p>}<div className="exchange-footer"><small>{new Date(item.createdAt).toLocaleDateString()}</small><div>{incoming && item.status === 'Pending' && <><button className="button button-primary button-small" onClick={() => action(item._id, 'Accepted')}>Accept</button><button className="button button-light button-small" onClick={() => action(item._id, 'Rejected')}>Decline</button></>}{!incoming && item.status === 'Pending' && <button className="button button-light button-small" onClick={() => cancel(item._id)}>Cancel request</button>}{item.status === 'Accepted' && <button className="button button-light button-small" onClick={() => action(item._id, 'Completed')}><Check size={13} /> Mark complete</button>}</div></div></article>; };
  return <Layout active="/exchanges"><PageTitle eyebrow="LEARN BY SHARING" title="Skill exchanges" subtitle="Agree on a skill swap, then learn something together." action={<Link className="button button-primary" to="/discover"><Compass size={16} /> Find a skill match</Link>} /><Notice error={error} />{busy ? <div className="loading-line"><div className="spinner" /> Loading exchanges…</div> : <div className="request-columns"><section className="content-panel"><div className="section-heading"><div><h2>Received</h2><p>{received.length} exchange requests</p></div></div>{received.length ? received.map((item) => card(item, true)) : <Empty icon={BookOpen} title="No incoming exchanges">When someone suggests a skill swap, you’ll see it here.</Empty>}</section><section className="content-panel"><div className="section-heading"><div><h2>Sent</h2><p>{sent.length} exchange requests</p></div></div>{sent.length ? sent.map((item) => card(item, false)) : <Empty icon={Sparkles} title="No exchanges yet">Find someone who wants to learn a skill you know.</Empty>}</section></div>}</Layout>;
}

function Chats() {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatVersion, setChatVersion] = useState(0);
  const historyRef = useRef(null);
  const shouldScrollRef = useRef(true);
  const activeFriend = friends.find((person) => person._id === userId);

  useEffect(() => {
    let active = true;
    api.get('/chats').then(({ data }) => { if (active) setFriends(data.friends); })
      .catch((e) => { if (active) setError(messageFrom(e)); })
      .finally(() => { if (active) setLoadingFriends(false); });
    return () => { active = false; };
  }, [userId, chatVersion]);

  // Refresh an open conversation every few seconds so new replies appear without reloading.
  useEffect(() => {
    if (!userId) { setMessages([]); setLoadingMessages(false); return undefined; }
    setMessages([]);
    setLoadingMessages(true);
    shouldScrollRef.current = true;
    let active = true;
    const refresh = (showLoading = false) => {
      if (showLoading) setLoadingMessages(true);
      api.get(`/chats/${userId}/messages`).then(({ data }) => {
        if (active) { setMessages(data.messages); setError(''); }
      }).catch((e) => { if (active) setError(messageFrom(e)); })
        .finally(() => { if (active && showLoading) setLoadingMessages(false); });
    };
    refresh(true);
    const timer = window.setInterval(() => refresh(), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [userId]);

  useEffect(() => {
    if (historyRef.current && shouldScrollRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [messages, userId]);

  const trackHistoryScroll = () => {
    const node = historyRef.current;
    if (node) shouldScrollRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 90;
  };

  const choosePdf = (event) => {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith('.pdf') || selected.type && selected.type !== 'application/pdf') {
      setError('Please choose a PDF file.'); return;
    }
    if (selected.size > 8 * 1024 * 1024) { setError('PDF files must be 8 MB or smaller.'); return; }
    setError(''); setFile(selected);
  };

  const send = async (event) => {
    event.preventDefault();
    if (!activeFriend || (!text.trim() && !file)) return;
    setSending(true); setError('');
    try {
      let pdf;
      if (file) {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('The PDF could not be read.'));
          reader.readAsDataURL(file);
        });
        pdf = { name: file.name, base64: String(dataUrl).split(',')[1] };
      }
      const { data } = await api.post(`/chats/${userId}/messages`, { text, pdf });
      setMessages((current) => [...current, data.message]);
      setText(''); setFile(null); setChatVersion((version) => version + 1);
    } catch (e) { setError(messageFrom(e)); }
    finally { setSending(false); }
  };

  const removeMessage = async (message) => {
    if (!window.confirm('Delete this message from your chat?')) return;
    try {
      await api.delete(`/chats/${userId}/messages/${message._id}`);
      setMessages((current) => current.filter((item) => item._id !== message._id));
      setChatVersion((version) => version + 1);
    } catch (e) { setError(messageFrom(e)); }
  };

  const clearHistory = async () => {
    if (!window.confirm('Clear this chat history from your view? The other student will keep their copy.')) return;
    try {
      await api.delete(`/chats/${userId}`);
      setMessages([]); setChatVersion((version) => version + 1);
    } catch (e) { setError(messageFrom(e)); }
  };

  const downloadPdf = async (message) => {
    try {
      const { data } = await api.get(`/chats/${userId}/files/${message._id}`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url; link.download = message.pdf.name; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(messageFrom(e)); }
  };

  return <Layout active="/chats"><PageTitle eyebrow="LEARN TOGETHER" title="Chats" subtitle="Share explanations, questions, and PDF notes with your connections." />
    <Notice error={error} />
    <div className="chat-layout">
      <section className="chat-people content-panel">
        <div className="section-heading"><div><h2>Your connections</h2><p>Choose a student to open a chat.</p></div></div>
        {loadingFriends ? <div className="loading-line"><div className="spinner" /> Loading chats…</div> : friends.length ? friends.map((person) => <button key={person._id} className={`chat-person ${person._id === userId ? 'selected' : ''}`} onClick={() => navigate(`/chats/${person._id}`)}>
          <Avatar user={person} size="small" /><span className="chat-person-copy"><b>{person.name}</b><small>{person.lastMessage || 'Start sharing knowledge'}</small></span>{person.lastMessageAt && <time>{new Date(person.lastMessageAt).toLocaleDateString()}</time>}
        </button>) : <Empty icon={Users} title="No connections yet">Connect with a student first, then start a private chat.</Empty>}
      </section>

      <section className="chat-window content-panel">
        {activeFriend ? <>
          <header className="chat-header"><Avatar user={activeFriend} size="small" /><div><b>{activeFriend.name}</b><span>Private knowledge sharing</span></div><button className="button button-light button-small" onClick={clearHistory} disabled={!messages.length}><Trash2 size={13} /> Clear history</button></header>
          <div className="chat-history" ref={historyRef} onScroll={trackHistoryScroll}>
            {loadingMessages ? <div className="loading-line"><div className="spinner" /> Loading messages…</div> : messages.length ? messages.map((message) => {
              const mine = String(message.senderId) === String(user?._id);
              return <article className={`chat-bubble-row ${mine ? 'mine' : ''}`} key={message._id}>
                <div className="chat-bubble">
                  {message.text && <p>{message.text}</p>}
                  {message.pdf && <button className="chat-pdf" onClick={() => downloadPdf(message)}><FileText size={18} /><span><b>{message.pdf.name}</b><small>{(message.pdf.size / (1024 * 1024)).toFixed(2)} MB · Download PDF</small></span></button>}
                  <footer><time>{new Date(message.createdAt).toLocaleString()}</time><button onClick={() => removeMessage(message)} aria-label="Delete message for me" title="Delete for me"><Trash2 size={13} /></button></footer>
                </div>
              </article>;
            }) : <Empty icon={MessageCircle} title="Start a learning chat">Ask a question, explain a skill, or share a PDF to help each other learn.</Empty>}
          </div>
          <form className="chat-compose" onSubmit={send}>
            <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength="5000" rows="3" placeholder={`Write a message to ${activeFriend.name}…`} aria-label="Chat message" />
            <div className="chat-compose-actions">
              <label className="button button-light button-small"><FileText size={14} /> Attach PDF<input type="file" accept="application/pdf,.pdf" onChange={choosePdf} hidden /></label>
              {file && <span className="chat-selected-file">{file.name}<button type="button" onClick={() => setFile(null)} aria-label="Remove attached PDF"><X size={13} /></button></span>}
              <button className="button button-primary button-small" disabled={sending || (!text.trim() && !file)}>{sending ? 'Sending…' : 'Send'} <Send size={13} /></button>
            </div>
            <small>PDF files up to 8 MB are saved with the chat history.</small>
          </form>
        </> : <div className="chat-no-selection"><MessageCircle size={30} /><h2>Choose a student</h2><p>Your messages and shared PDFs will appear here.</p></div>}
      </section>
    </div>
  </Layout>;
}

function Notifications() {
  const [items, setItems] = useState([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(true);
  const reload = () => api.get('/notifications').then(({ data }) => setItems(data.notifications)).catch((e) => setError(messageFrom(e))).finally(() => setBusy(false));
  useEffect(() => { reload(); }, []);
  const read = async (item) => { if (!item.isRead) { try { await api.put(`/notifications/${item._id}/read`); setItems(items.map((entry) => entry._id === item._id ? { ...entry, isRead: true } : entry)); } catch (e) { setError(messageFrom(e)); } } };
  return <Layout active="/notifications"><PageTitle eyebrow="A LITTLE UPDATE" title="Notifications" subtitle="Keep up with the people learning and sharing with you." />{busy ? <div className="loading-line"><div className="spinner" /> Loading notifications…</div> : <section className="content-panel notifications-panel"><Notice error={error} />{items.length ? items.map((item) => <button className={`notification-row ${item.isRead ? '' : 'unread'}`} key={item._id} onClick={() => read(item)}><div className={`notification-icon ${item.type.startsWith('exchange') ? 'blue' : 'violet'}`}>{item.type.startsWith('exchange') ? <BookOpen size={18} /> : <Users size={18} />}</div><div><b>{item.message}</b><span>{new Date(item.createdAt).toLocaleString()}</span></div>{!item.isRead && <i />}</button>) : <Empty icon={Bell} title="You’re all caught up">Updates about requests and skill exchanges will show up here.</Empty>}</section>}</Layout>;
}

function App() {
  return <AuthProvider><Routes><Route path="/" element={<Landing />} /><Route path="/signup" element={<AuthPage mode="signup" />} /><Route path="/signin" element={<AuthPage mode="signin" />} /><Route path="/app" element={<Protected><Dashboard /></Protected>} /><Route path="/discover" element={<Protected><SearchPeople /></Protected>} /><Route path="/search" element={<Protected><SearchPeople /></Protected>} /><Route path="/profile/:id" element={<Protected><Profile /></Protected>} /><Route path="/my-profile" element={<Protected><Profile own /></Protected>} /><Route path="/edit-profile" element={<Protected><EditProfile /></Protected>} /><Route path="/friends" element={<Protected><Friends /></Protected>} /><Route path="/chats" element={<Protected><Chats /></Protected>} /><Route path="/chats/:userId" element={<Protected><Chats /></Protected>} /><Route path="/requests" element={<Protected><ConnectionRequests /></Protected>} /><Route path="/exchanges" element={<Protected><Exchanges /></Protected>} /><Route path="/notifications" element={<Protected><Notifications /></Protected>} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></AuthProvider>;
}

// Start the website with browser URL routing enabled.
const Root = () => <BrowserRouter><App /></BrowserRouter>;
createRoot(document.getElementById('root')).render(<React.StrictMode><Root /></React.StrictMode>);
