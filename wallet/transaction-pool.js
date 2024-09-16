const Transaction = require('./transaction');
const TransactionPoolModel = require('../models/transactionPool'); // Import the TransactionPool model


class TransactionPool{
    constructor() {
        this.transactionMap = {};
    }

    clear(){
        this.transactionMap = {};
    }

    async setTransaction(transaction) {
        this.transactionMap[transaction.id] = transaction;

        // Save the updated transactionMap to MongoDB
        try {
            await TransactionPoolModel.updateTransactionPool(this.transactionMap);
            console.log('Transaction pool updated in MongoDB');
        } catch (err) {
            console.error('Error saving transaction pool to MongoDB:', err);
        }
    }

    setMap(transactionMap){
        this.transactionMap = transactionMap;
    }

    async existingTransaction({ inputAddress }) {
        try {
            // Fetch the transaction pool from MongoDB
            const transactionPool = await TransactionPoolModel.findOne();
    
            if (!transactionPool || !transactionPool.transactionMap) {
                console.log('Transaction pool is empty or not found in MongoDB.');
                return null;
            }
    
            // Convert the transactionMap object to an array of transactions
            const transactions = Object.values(transactionPool.transactionMap);
    
            // Debugging: Log each transaction to check the structure
            transactions.forEach((transaction, index) => {
                console.log(`Transaction ${index}:`, transaction);
                if (transaction.input) {
                    console.log(`Transaction ${index} input:`, transaction.input);
                } else {
                    console.log(`Transaction ${index} has no input field.`);
                }
            });
    
            // Find the transaction by inputAddress, with added safety check
            return transactions.find(transaction => transaction.input && transaction.input.address === inputAddress);
        } catch (error) {
            console.error('Error fetching transaction from MongoDB:', error);
            throw error;
        }
    }
    
    

    // existingTransaction({inputAddress}){
    //     const transactions = Object.values(this.transactionMap);

    //     return transactions.find(transaction => transaction.input.address == inputAddress);
    // }


    validTransactions() {
        return Object.values(this.transactionMap).filter(
            transaction => Transaction.validTransaction(transaction)
        );
    }

    clearBlockchainTransactions({ chain }){
        for(let i = 1; i<chain.length; i++){
            const block = chain[i];

            for(let transaction of block.data){
                if(this.transactionMap[transaction.id]){
                    delete this.transactionMap[transaction.id];
                }
            }
        }
    }


    static async getUserTransactions(publicKey) {
        try {
            // 2. Fetch pending transactions from transactionPool collection
            const transactionPool = await TransactionPoolModel.findOne();

            const pendingTransactions = [];

            if (transactionPool && transactionPool.transactionMap) {
                const transactionsArray = Array.from(transactionPool.transactionMap.values());

                transactionsArray.forEach(transaction => {
                    if (transaction.input.address === publicKey || transaction.outputMap[publicKey]) {
                        pendingTransactions.push({ ...transaction, status: 'pending' });
                    }
                });
            }

            // Combine sent and pending transactions
            const userTransactions = [...sentTransactions, ...pendingTransactions];

            return userTransactions;
        } catch (error) {
            console.error('Error fetching user transactions:', error);
            throw new Error('An error occurred while fetching transactions');
        }
    }


}

module.exports = TransactionPool;