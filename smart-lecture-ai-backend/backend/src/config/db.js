const mongoose = require('mongoose');

async function connectDB(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('MongoDB connected');
}

module.exports = connectDB;
