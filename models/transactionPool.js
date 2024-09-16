const mongoose = require('mongoose');

const TransactionPoolSchema = new mongoose.Schema({
    transactionMap: {
        type: Map,
        of: Object, // Store each transaction as an object
        required: true,
        default: {}
    }
});

// Static method to update the transaction pool in MongoDB
TransactionPoolSchema.statics.updateTransactionPool = async function(transactionMap) {
    try {
        let pool = await this.findOne(); // Find the existing transaction pool document

        if (!pool) {
            pool = new this({ transactionMap }); // If no pool exists, create a new one
        } else {
            pool.transactionMap = transactionMap; // Update the existing pool
        }

        return pool.save(); // Save the document
    } catch (error) {
        console.error('Error updating transaction pool in MongoDB:', error);
        throw error;
    }
};

// Add the setTransaction method to the schema
TransactionPoolSchema.methods.setTransaction = async function(transaction) {
    try {
        
        // Add or update the transaction in the transactionMap
        this.transactionMap.set(transaction.id, transaction);
        
        await this.save();
        
        console.log("Transaction pool saved successfully.");
    } catch (error) {
        console.error("Error saving transaction to MongoDB:", error);
        throw error;
    }
};

// Define the existingTransaction method on the schema
TransactionPoolSchema.methods.existingTransaction = function({ inputAddress }) {
    const transactions = Object.values(this.transactionMap);
    return transactions.find(transaction => transaction.input && transaction.input.address === inputAddress);
};


const TransactionPool = mongoose.model('TransactionPool', TransactionPoolSchema);
module.exports = TransactionPool;
