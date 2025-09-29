// server.js (minimal)
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/public/input.html'));
});

app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('ERROR: MONGO_URI not set in .env');
  process.exit(1);
}

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=>console.log('✅ MongoDB connected'))
  .catch(err=>{
    console.error('MongoDB connection error:', err.message || err);
    process.exit(1);
  });

const RowSchema = new mongoose.Schema({
  coal: String,
  percentages: [Number],
  gcv: Number,
  cost: Number
}, { _id: false });

const BlendSchema = new mongoose.Schema({
  rows: [RowSchema],
  flows: [Number],
  generation: Number,
  createdAt: { type: Date, default: Date.now }
});

const Blend = mongoose.model('Blend', BlendSchema);

app.post('/api/blend', async (req, res) => {
  try {
    const { rows, flows, generation } = req.body;
    if (!Array.isArray(rows) || !Array.isArray(flows)) {
      return res.status(400).json({ error: 'Invalid payload: rows[] and flows[] required' });
    }
    const doc = new Blend({ rows, flows, generation });
    await doc.save();
    res.status(201).json({ message: 'Saved', id: doc._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/blend/latest', async (req, res) => {
  try {
    const latest = await Blend.findOne().sort({ createdAt: -1 }).lean();
    if (!latest) return res.status(404).json({ error: 'No blends found' });
    res.json(latest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// update blend by ID
app.put('/api/blend/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows, flows, generation } = req.body;
    if (!Array.isArray(rows) || !Array.isArray(flows)) {
      return res.status(400).json({ error: 'Invalid payload: rows[] and flows[] required' });
    }

    const updated = await Blend.findByIdAndUpdate(
      id,
      { rows, flows, generation, ts: Date.now() },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Blend not found' });

    res.json({ message: 'Updated', id: updated._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


const PORT = process.env.PORT || 5000;
//const path = require('path');
app.listen(PORT, ()=>console.log(`Server listening on ${PORT}`));
