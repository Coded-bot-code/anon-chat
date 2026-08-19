require('dotenv').config();
const express = require('express');
const axios = require('axios');
const session = require('express-session');
const connectMongo = require('connect-mongo');
const path = require('path');
const { connectDB } = require('./db');

// Resolve MongoStore export cleanly across v3/v4/v5 versions
const MongoStore = connectMongo.default || connectMongo;

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const publicRoutes = require('./routes/public');
const inboxRoutes = require('./routes/inbox');
const settingsRoutes = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust HTTPS proxy on Render
app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 1. Body parsers and static assets
app.use(express.urlencoded({ extended: true, limit: '3mb' }));
app.use(express.json({ limit: '3mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 2. Session middleware (MUST come before any route handlers or res.locals middleware)
app.use(session({
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 7 * 24 * 60 * 60 // 7 days
  }),
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-env',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

// 3. Populate res.locals AFTER session middleware initialized req.session
app.use((req, res, next) => {
  if (req.session && req.session.user) {
    console.log('Session user ID:', req.session.user.id);
    console.log('Session username:', req.session.user.username);
  }
  next();
});

// 4. Authentication middleware check
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }
  next();
}

// 5. Base landing page route
app.get('/', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/dashboard');
  res.render('landing');
});

app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// 6. Routes
app.use('/', authRoutes);
app.use('/dashboard/settings', requireAuth, settingsRoutes);
app.use('/dashboard', requireAuth, dashboardRoutes);
app.use('/inbox', inboxRoutes);
app.use('/dashboard/inbox', inboxRoutes);
app.use('/u', publicRoutes);
app.use('/confess', publicRoutes);
app.use('/about', publicRoutes);
app.use('/ask', publicRoutes);
app.use('/opinion', publicRoutes);
app.use('/crush', publicRoutes);
app.use('/compliment', publicRoutes);
app.use('/roast', publicRoutes);

// 7. 404 Handler
app.use((req, res) => {
  res.status(404).render('404');
});

// In server.js, replace the connectDB() call with:

(async () => {
  await connectDB();
  
  app.listen(PORT, () => {
    console.log(`Anon chat app running at http://localhost:${PORT}`);

    // Self-ping for Render (14 minutes)
    if (process.env.RENDER_EXTERNAL_URL) {
      console.log('Auto-ping enabled for Render');
      const renderUrl = process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '');
      setInterval(() => {
        axios.get(renderUrl + '/ping')
          .then(() => console.log('Ping successful'))
          .catch(() => console.log('Ping failed'));
      }, 14 * 60 * 1000);
    }
  });
})();