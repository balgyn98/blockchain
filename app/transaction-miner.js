const Transaction = require('../wallet/transaction');
const BlockModel = require('../models/block'); // Mongoose Block model
const TransactionPoolModel = require('../models/transactionPool'); // Mongoose TransactionPool model
const { ec, cryptoHash } = require('../util');
const Wallet = require('../wallet');


class TransactionMiner {
    constructor({ blockchain, transactionPool, wallet, pubsub }) {
        this.blockchain = blockchain;
        this.transactionPool = transactionPool;
        this.wallet = wallet;
        this.pubsub = pubsub;
    }

    async mineTransactions(user) {
        // Fetch valid transactions from MongoDB
        let validTransactions = await this.fetchValidTransactionsFromDB();
        console.log("validTransactions = ", validTransactions);

        const keyPair = ec.keyFromPrivate(user.privateKey, 'hex');

        const wallet2 = new Wallet({
            publicKey: user.publicKey,
            keyPair: keyPair,
            balance: user.balance
        });

        // validTransactions.push(
        //     Transaction.rewardTransaction({ minerWallet: wallet2 })
        // );
        console.log("transaction-miner balance before = ", user.balance);

        // If rewardTransaction is an async function, await it before pushing it into the array
        const rewardTransaction = await Transaction.rewardTransaction({ minerWallet: wallet2 });

        // validTransactions.push(rewardTransaction);
        
        // Ensure validTransactions is still an array
        if (Array.isArray(validTransactions)) {
            validTransactions.push(rewardTransaction);
        } else {
            console.error("validTransactions is not an array:", validTransactions);
            throw new Error("validTransactions is not an array.");
        }

        console.log("transaction-miner balance = ", user.balance);

        // Mine a new block with these transactions
        const newBlock = this.blockchain.addBlock({ data: validTransactions });

        // Save the new block to MongoDB
        await this.saveBlockToDB(newBlock);

        // Broadcast the updated blockchain
        this.pubsub.broadcastChain();

        // Clear the transaction pool
        await this.clearTransactionPoolInDB();
    }

    // async fetchValidTransactionsFromDB() {
    //     try {
    //         // Fetch the transaction pool from MongoDB
    //         const transactionPool = await TransactionPoolModel.findOne();

    //         console.log("transactionPool = ", transactionPool);

    //         if (!transactionPool || !transactionPool.transactionMap) {
    //             console.error('Transaction pool is empty or undefined.');
    //             return [];
    //         }

    //         // Get the transactions from the transactionMap
    //         const transactions = Object.values(transactionPool.transactionMap);

    //         // Filter and return only valid transactions
    //         return transactions.filter(transaction => Transaction.validTransaction(transaction));
    //     } catch (error) {
    //         console.error('Error fetching transactions from MongoDB:', error);
    //         return [];
    //     }
    // }

    async fetchValidTransactionsFromDB() {
        try {
            const transactionPool = await TransactionPoolModel.findOne();
        
            if (!transactionPool || !transactionPool.transactionMap) {
                console.error('Transaction pool is empty or undefined.');
                return [];
            }
    
            // const transactions = Object.values(transactionPool.transactionMap);
            // const transactions = Array.from(transactionPool.transactionMap.values());
            // console.log("transaction pool miner = ", transactionPool);
            // console.log("transactions miner = ", transactions);

            // return Object.values(this.transactionPool.transactionMap).filter(
            //     transaction => Transaction.validTransaction(transaction)
            // );


            // Step 1: Convert the transactionMap object to an array of transactions
            const transactionsArray = Array.from(transactionPool.transactionMap.values());

            // Step 2: Filter the array to include only valid transactions
            const validTransactions = transactionsArray.filter(transaction => {
                const isValid = Transaction.validTransaction(transaction);
                return isValid;
            });

            // Step 3: Return the filtered array of valid transactions
            return transactionsArray;

            } catch (error) {
            console.error('Error fetching transactions from MongoDB:', error);
            return [];
        }
    }

    async saveBlockToDB(block) {
        try {
            // Create a new instance of the Mongoose Block model using the block data
            const blockModel = new BlockModel({
                timestamp: block.timestamp,
                lastHash: block.lastHash,
                hash: block.hash,
                data: block.data,
                nonce: block.nonce,
                difficulty: block.difficulty
            });

            // Save the new block to MongoDB
            await blockModel.save();
            console.log('New block saved to MongoDB');
        } catch (error) {
            console.error('Error saving block to MongoDB:', error);
        }
    }

    async clearTransactionPoolInDB() {
        try {
        // Clear the in-memory transaction map
        this.transactionMap = {};

        // Clear the transaction pool in MongoDB
        await TransactionPoolModel.deleteMany({});
            console.log('Transaction pool cleared in MongoDB');
        } catch (error) {
            console.error('Error clearing transaction pool in MongoDB:', error);
        }
    }


    async getUserWallet(username) {
        try {
            // Find the user by username
            const user = await UserModel.findOne({ username });
    
            if (!user) {
                throw new Error('User not found');
            }
    
            // Extract the wallet information
            const wallet = {
                publicKey: user.publicKey,
                balance: user.balance
            };    
            return wallet;
        } catch (error) {
            console.error('Error fetching user wallet:', error);
            throw error;
        }
    }


}

module.exports = TransactionMiner;










// const Transaction = require('../wallet/transaction');

// class TransactionMiner {
//     constructor({ blockchain, transactionPool, wallet, pubsub}){
//         this.blockchain = blockchain;
//         this.transactionPool = transactionPool;
//         this.wallet = wallet;
//         this.pubsub = pubsub;
//     }

//     mineTransactions() {

//         const validTransactions = this.transactionPool.validTransactions();

//         validTransactions.push(
//             Transaction.rewardTransaction({minerWallet: this.wallet})
//         );

//         this.blockchain.addBlock({data: validTransactions});

//         this.pubsub.broadcastChain();

//         this.transactionPool.clear();
//     }

// }

// module.exports = TransactionMiner;