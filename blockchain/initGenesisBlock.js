const mongoose = require('mongoose');
const Block = require('./block'); // Adjust the path to where your Block model is defined
const BlockModel = require('../models/block');

async function addGenesisBlockToDB() {
    const genesisBlock = Block.genesis();

    // Check if the genesis block already exists in the database
    const existingBlock = await BlockModel.findOne({ hash: genesisBlock.hash });

    if (!existingBlock) {
        // If the genesis block does not exist, save it to the database
        const newBlock = new BlockModel({
            timestamp: genesisBlock.timestamp,
            lastHash: genesisBlock.lastHash,
            hash: genesisBlock.hash,
            data: genesisBlock.data,
            nonce: genesisBlock.nonce,
            difficulty: genesisBlock.difficulty,
        });

        await newBlock.save();
        console.log('Genesis block added to the database');
    } else {
        console.log('Genesis block already exists in the database');
    }
}

mongoose.connect('mongodb://localhost:27017/blockchain24', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB');
    addGenesisBlockToDB();
}).catch((err) => {
    console.error('Failed to connect to MongoDB', err);
});
