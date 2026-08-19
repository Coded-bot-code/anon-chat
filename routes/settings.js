const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcrypt');
const { User } = require('../db');

// Multer storage setup for profile photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    // req.session.user.id (not ._id) — session.user is a plain object set at
    // login/signup as { id, username }, not a Mongoose document.
    cb(null, `avatar-${req.session.user.id}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed.'));
    }
  }
});

// GET Settings Page
router.get('/', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }

  try {
    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.redirect('/login');
    }

    res.render('settings', {
      user,
      profilePhoto: user.profile_photo || null,
      username: user.username,
      displayName: user.display_name || user.username,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Settings route error:', err);
    res.redirect('/dashboard?error=Could not load settings');
  }
});

// POST Update Profile (Display Name & Avatar Upload)
router.post('/profile', (req, res) => {
  upload.single('avatar')(req, res, async (uploadErr) => {
    if (!req.session.user) return res.redirect('/login');

    if (uploadErr) {
      console.error('Avatar upload error:', uploadErr);
      return res.redirect('/dashboard/settings?error=' + encodeURIComponent(uploadErr.message || 'Failed to upload photo'));
    }

    try {
      const { displayName } = req.body;
      const updateData = {};

      if (displayName && displayName.trim()) {
        updateData.display_name = displayName.trim();
      }
      if (req.file) {
        updateData.profile_photo = `/uploads/${req.file.filename}`;
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.session.user.id,
        updateData,
        { new: true }
      );

      if (!updatedUser) {
        return res.redirect('/login');
      }

      // Keep the session's display name in sync (used elsewhere in the app).
      req.session.user.display_name = updatedUser.display_name;

      res.redirect('/dashboard/settings?success=' + encodeURIComponent('Profile updated successfully'));
    } catch (err) {
      console.error('Profile update error:', err);
      res.redirect('/dashboard/settings?error=' + encodeURIComponent('Failed to update profile'));
    }
  });
});

// POST Update Password
router.post('/password', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.redirect('/dashboard/settings?error=' + encodeURIComponent('New password must be at least 6 characters'));
    }

    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect('/login');

    const isMatch = await bcrypt.compare(currentPassword || '', user.password_hash);
    if (!isMatch) {
      return res.redirect('/dashboard/settings?error=' + encodeURIComponent('Incorrect current password'));
    }

    user.password_hash = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.redirect('/dashboard/settings?success=' + encodeURIComponent('Password updated successfully'));
  } catch (err) {
    console.error('Password update error:', err);
    res.redirect('/dashboard/settings?error=' + encodeURIComponent('Failed to update password'));
  }
});

// POST Delete Account
router.post('/delete', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  try {
    await User.findByIdAndDelete(req.session.user.id);
    req.session.destroy(() => {
      res.redirect('/');
    });
  } catch (err) {
    console.error('Delete account error:', err);
    res.redirect('/dashboard/settings?error=' + encodeURIComponent('Failed to delete account'));
  }
});

module.exports = router;
