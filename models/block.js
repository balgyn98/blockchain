const mongoose = require('mongoose');

const BlockSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    lastHash: { type: String, required: true },
    hash: { type: String, required: true },
    data: { type: Array, required: true },
    nonce: { type: Number, required: true },
    difficulty: { type: Number, required: true }
});

const Block = mongoose.model('Block', BlockSchema);
module.exports = Block;
