const mongoose = require('mongoose');

const ReservedTransactionSchema = new mongoose.Schema({
    transactionId: {
        type: String,
        required: true
    },
    reservedAmount: {
        type: Number,
        required: true
    }
});

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    publicKey: {
        type: String,
        required: true
    },
    balance: {
        type: Number,
        required: true
    },
    privateKey: { 
        type: String, 
        required: false
    },
    reservedTransactions: {
        type: [ReservedTransactionSchema],
        default: [],
        required: false
    }
});

const User = mongoose.model('User', UserSchema);

module.exports = User;
