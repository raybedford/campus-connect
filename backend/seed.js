const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const School = require('./models/School');
const User = require('./models/User');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');
const PublicKey = require('./models/PublicKey');
const config = require('./config');

async function seed() {
  try {
    await mongoose.connect(config.MONGO_URI);
    console.log('Connected to MongoDB for seeding...');

    // Clear existing data
    await Promise.all([
      School.deleteMany({}),
      User.deleteMany({}),
      Conversation.deleteMany({}),
      Message.deleteMany({}),
      PublicKey.deleteMany({})
    ]);

    // 1. Create School
    const school = await School.create({
      domain: 'coloradotech.edu',
      name: 'Colorado Technical University',
      logoUrl: 'https://logo.clearbit.com/coloradotech.edu'
    });

    // 2. Create Users
    const passwordHash = await bcrypt.hash('password123', 10);
    const users = await User.insertMany([
      {
        email: 'alex.j@coloradotech.edu',
        displayName: 'Alex Johnson',
        passwordHash,
        school: school._id,
        isVerified: true
      },
      {
        email: 'sarah.m@coloradotech.edu',
        displayName: 'Sarah Miller',
        passwordHash,
        school: school._id,
        isVerified: true
      },
      {
        email: 'jake.d@coloradotech.edu',
        displayName: 'Jake Davis',
        passwordHash,
        school: school._id,
        isVerified: true
      }
    ]);

    const alex = users[0];
    const sarah = users[1];
    const jake = users[2];

    // 3. Create Public Keys (Placeholders)
    await PublicKey.insertMany([
      { user: alex._id, publicKeyB64: 'base64_alex_pk', isActive: true },
      { user: sarah._id, publicKeyB64: 'base64_sarah_pk', isActive: true },
      { user: jake._id, publicKeyB64: 'base64_jake_pk', isActive: true }
    ]);

    // 4. Create a DM Conversation
    const dm = await Conversation.create({
      type: 'dm',
      school: school._id,
      createdBy: alex._id,
      members: [
        { user: alex._id },
        { user: sarah._id }
      ]
    });

    // 5. Create a Group Conversation
    const group = await Conversation.create({
      type: 'group',
      name: 'CS499 Study Group',
      school: school._id,
      createdBy: alex._id,
      members: [
        { user: alex._id },
        { user: sarah._id },
        { user: jake._id }
      ]
    });

    // 6. Create Messages
    await Message.insertMany([
      {
        conversation: dm._id,
        sender: alex._id,
        messageType: 'text',
        encryptedPayloads: [
          { recipientId: alex._id.toString(), ciphertextB64: btoa('Hey Sarah!'), nonceB64: 'none' },
          { recipientId: sarah._id.toString(), ciphertextB64: btoa('Hey Sarah!'), nonceB64: 'none' }
        ],
        createdAt: new Date(Date.now() - 3600000)
      },
      {
        conversation: dm._id,
        sender: sarah._id,
        messageType: 'text',
        encryptedPayloads: [
          { recipientId: alex._id.toString(), ciphertextB64: btoa('Hi Alex! Did you finish the lab?'), nonceB64: 'none' },
          { recipientId: sarah._id.toString(), ciphertextB64: btoa('Hi Alex! Did you finish the lab?'), nonceB64: 'none' }
        ],
        createdAt: new Date(Date.now() - 3500000)
      }
    ]);

    console.log('Seeding complete!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();
