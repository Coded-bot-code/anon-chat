const mongoose = require('mongoose');

// Connect to MongoDB using environment variable
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    await seedTemplates();
  } catch (err) {
    console.error(`MongoDB Connection Error: ${err.message}`);
    process.exit(1);
  }
};

// --- Schemas ---

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password_hash: {
    type: String,
    required: true
  },
  display_name: {
    type: String,
    required: true,
    trim: true
  },
  profile_photo: {
    type: String,
    default: ''
  }
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

const templateSchema = new mongoose.Schema({
  prompt: {
    type: String,
    required: true
  },
  mode: {
    type: String,
    default: 'anonymous'
  },
  active: {
    type: Boolean,
    default: true
  }
});

const messageSchema = new mongoose.Schema({
  recipient_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  prompt: {
    type: String,
    default: ''
  },
  mode: {
    type: String,
    default: 'anonymous'
  },
  body: {
    type: String,
    required: true
  },
  read: {
    type: Boolean,
    default: false
  },
  flagged: {
    type: Boolean,
    default: false
  },
  // One-way HMAC hash of the sender's IP (see utils/senderHash.js). Used only
  // to let a recipient block this sender from messaging them again — never
  // exposed to the client or shown to any user, admin included.
  sender_hash: {
    type: String,
    default: null,
    select: false
  }
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

// Tracks which (recipient, sender_hash) pairs are blocked. A blocked sender's
// future messages to that recipient are rejected at send time. This never
// stores or exposes the sender's actual IP/location/device — only an
// unreversible hash used purely for equality matching.
const blockedSenderSchema = new mongoose.Schema({
  recipient_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender_hash: {
    type: String,
    required: true
  }
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

blockedSenderSchema.index({ recipient_id: 1, sender_hash: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);
const Template = mongoose.model('Template', templateSchema);
const Message = mongoose.model('Message', messageSchema);
const BlockedSender = mongoose.model('BlockedSender', blockedSenderSchema);

// --- Seed Default Templates ---
const seedTemplates = async () => {
  try {
    await Template.updateMany({ mode: { $exists: false } }, { $set: { mode: 'anonymous' } });
    const promptGroups = {
      anonymous: ['What is something you have always wanted to tell me?', 'Ask me anything anonymously.', 'What is your first impression of me?', 'Tell me a secret.', 'What should I try next?', 'What reminds you of me?', 'What is one thing I do well?', 'What is one thing I should improve?', 'Send me an honest message.', 'What would you say if there were no consequences?', 'What is your favorite memory of me?', 'What do you think I am like in private?', 'Tell me something unexpected.', 'What question should I answer?', 'Say whatever is on your mind.'],
      confessions: ['Confess something you have never told anyone.', 'Tell me a secret you are keeping.', 'What have you always wanted to say?', 'Confess your most embarrassing moment.', 'What is something you regret?', 'Tell me a truth you usually hide.', 'What is your guilty pleasure?', 'What have you been afraid to admit?', 'Confess a harmless lie you told.', 'What is something you miss?', 'Tell me about a choice you would change.', 'What is your biggest secret?', 'What do you pretend not to care about?', 'Confess something small and silly.', 'What is the honest thought in your head?'],
      about: ['One thing you like about me?', 'One thing you dislike about me?', 'One thing I should know?', 'What kind of person do I seem like?', 'What is my best quality?', 'What is my most noticeable habit?', 'What do you think I care about?', 'What makes me different?', 'What should I do more often?', 'What should I stop doing?', 'What is something I do not notice about myself?', 'What is your favorite thing about me?', 'How would you describe me?', 'What do people misunderstand about me?', 'What is one thing you would change about me?'],
      ask: ['Ask me anything.', 'What would you like to know about me?', 'Ask the question you are too shy to ask.', 'What are you curious about?', 'Ask me a difficult question.', 'What should I explain?', 'Ask me something personal.', 'What have you always wondered?', 'Ask me for advice.', 'What question is on your mind?', 'Ask me a fun question.', 'What would you ask me in person?', 'Ask me something unexpected.', 'What answer do you want from me?', 'Ask me anything, no judgment.'],
      opinion: ['What is your honest opinion of me?', 'What should I improve?', 'What was your first impression of me?', 'What do you honestly think about my personality?', 'What is my strongest quality?', 'What is my weakest quality?', 'What do I get wrong?', 'What should I hear today?', 'How could I be a better friend?', 'What do people say about me?', 'What is one honest observation?', 'What do you respect about me?', 'What do you find difficult about me?', 'What advice would you give me?', 'Give me feedback without holding back.'],
      crush: ['Do you have a crush on me?', 'Have you ever secretly liked me?', 'What do you find attractive about me?', 'Would you ever ask me out?', 'What was your first thought when you saw me?', 'Tell me your secret feelings.', 'What song reminds you of me?', 'Would we make a good couple?', 'What is your favorite thing about me?', 'Have you ever dreamed about me?', 'What would our first date be like?', 'Do you think I am your type?', 'What would you say if I liked you?', 'Who is your secret crush?', 'Send me a love message.'],
      compliment: ['Send me a compliment.', 'What is my best quality?', 'What do you admire about me?', 'Tell me something kind.', 'What makes me special?', 'What is your favorite thing about me?', 'What do I do better than I realize?', 'Say something that would make me smile.', 'What is my most attractive quality?', 'What do you appreciate about me?', 'Tell me why you like having me around.', 'What is something you respect about me?', 'Give me a confidence boost.', 'What makes me unforgettable?', 'Send me your sweetest compliment.'],
      roast: ['Roast me anonymously.', 'Give me your funniest roast.', 'What is my most annoying habit?', 'Make fun of me gently.', 'What do I take too seriously?', 'What is my biggest clown moment?', 'What would you roast me for?', 'Give me a playful insult.', 'What is my most predictable move?', 'What should I be embarrassed about?', 'Describe my worst habit.', 'What is the funniest thing about me?', 'Roast my style.', 'What would your group chat say about me?', 'Give me your best harmless roast.']
    };

    for (const [mode, prompts] of Object.entries(promptGroups)) {
      const existing = await Template.countDocuments({ mode });
      if (existing < prompts.length) {
        const current = await Template.find({ mode }).select('prompt').lean();
        const known = new Set(current.map((item) => item.prompt));
        await Template.insertMany(prompts.filter((prompt) => !known.has(prompt)).map((prompt) => ({ prompt, mode })));
      }
    }
    console.log('Mode-specific prompt templates ready');
  } catch (err) {
    console.error('Template seeding error:', err.message);
  }
};

module.exports = {
  connectDB,
  User,
  Template,
  Message,
  BlockedSender
};