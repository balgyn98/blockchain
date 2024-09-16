const uuid = require('uuid/v1');
const {verifySignature} = require('../util');
const {REWARD_INPUT, MINING_REWARD} = require('../config');
const UserModel = require('../models/user');
const TransactionPoolModel = require('../models/transactionPool');
const BlockModel = require('../models/block');



class Transaction {
    constructor({ senderWallet, recipient, amount, outputMap, input }) {
        this.id = uuid();
        this.outputMap = outputMap || this.createOutputMap({ senderWallet, recipient, amount});
        this.input = input || this.createInput({ senderWallet, outputMap: this.outputMap });
    }

    createOutputMap({ senderWallet, recipient, amount}){
        const outpuMap = {};


        outpuMap[recipient] = amount;
        outpuMap[senderWallet.publicKey] = senderWallet.balance - amount;

        return outpuMap;

    }

    createInput({ senderWallet, outputMap }){
        return {
            timestamp: Date.now(),
            amount: senderWallet.balance,
            address: senderWallet.publicKey,
            signature: senderWallet.sign(outputMap)
        };
    }

    update({ senderWallet, recipient, amount}) {

        if(amount > this.outputMap[senderWallet.publicKey]){
            throw new Error('Amount exceeds balance');
        }

        if(!this.outputMap[recipient]) {
            this.outputMap[recipient] = amount;
        } else {
            this.outputMap[recipient]= this.outputMap[recipient] + amount;
        }

        this.outputMap[senderWallet.publicKey] = 
            this.outputMap[senderWallet.publicKey] - amount;

        this.input = this.createInput({ senderWallet, outputMap: this.outputMap });
    }
 
    // static validTransaction(transaction){

    //     const { input: {address, amount, signature}, outputMap } = transaction;

    //     const outputTotal = Object.values(outputMap).reduce((total, outputAmount) => total + outputAmount);
        
    //     if(amount !== outputTotal){
    //         console.error(`Invalid transaction from ${address}`);
    //         return false;
    //     }

    //     if(!verifySignature({publicKey: address, data: outputMap, signature})){
    //         console.error(`Invalid signature from ${address}`);
    //         return false;
    //     }
    //     return true;
    // }

    static validTransaction(transaction) {
        // Destructure input and outputMap from the transaction

        const { input, outputMap } = transaction;
    
        // Check if input or its properties are undefined
        if (!input || typeof input.address === 'undefined' || typeof input.amount === 'undefined' || typeof input.signature === 'undefined') {
            console.error('Invalid transaction: missing input or input properties');
            return false;
        }
    
        const { address, amount, signature } = input;
    
        // Calculate the total output amount
        const outputTotal = Object.values(outputMap).reduce((total, outputAmount) => total + outputAmount, 0);
    
        // Check if the total output amount matches the input amount
        if (amount !== outputTotal) {
            console.error(`Invalid transaction from ${address}: output total (${outputTotal}) does not match input amount (${amount})`);
            return false;
        }
    
        // Verify the transaction signature
        if (!verifySignature({ publicKey: address, data: outputMap, signature })) {
            console.error(`Invalid signature from ${address}`);
            return false;
        }
    
        return true;
    }

    
    // static rewardTransaction({ minerWallet }) {
    //     return new this({
    //       input: REWARD_INPUT,
    //       outputMap: { [minerWallet.publicKey]: MINING_REWARD }
    //     });
    //   }

    static async rewardTransaction({ minerWallet }) {
        const rewardTransaction = new this({
            input: REWARD_INPUT,
            outputMap: { [minerWallet.publicKey]: MINING_REWARD }
        });
        // Update miner's balance in MongoDB
        await this.updateMinerBalance(minerWallet.publicKey, MINING_REWARD);
    
        return rewardTransaction;
    }

    static async updateMinerBalance(publicKey, reward) {
        try {
            // Find the user by their public key
            const user = await UserModel.findOne({ publicKey });
    
            if (!user) {
                throw new Error('Miner not found');
            }
    
            // Update the user's balance by adding the mining reward
            user.balance = (user.balance || 0) + reward;
    
            // Save the updated user balance to the database
            await user.save();
    
            console.log(`Miner's balance updated: ${user.balance}`);
        } catch (error) {
            console.error('Error updating miner balance:', error);
        }
    }

    static async reconcileUserReservedTransactions(username) {
        try {
            const user = await UserModel.findOne({ username: username });
    
            if (!user) {
                console.log(`User not found for username: ${username}`);
                return;
            }
    
            let balanceAdjustment = 0;
            let transactionsToKeep = [];
    
            const transactionPool = await TransactionPoolModel.findOne();
            const transactionPoolMap = transactionPool ? transactionPool.transactionMap : {};
    
            for (const reservedTransaction of user.reservedTransactions) {
                const { transactionId, reservedAmount } = reservedTransaction;
    
                const blockContainingTransaction = await BlockModel.findOne({
                    'data.id': transactionId
                });
    
                if (blockContainingTransaction) {
                // Find the transaction within the block's data
                const transaction = blockContainingTransaction.data.find(tx => tx.id === transactionId);

                if (transaction) {
                    console.log(`Transaction ID ${transactionId} found in block ${blockContainingTransaction._id}. Removing from reserved transactions and adjusting balance.`);

                    const keys = Object.keys(transaction.outputMap);
                    const firstKey = keys[0]; // 'sdf'
                    let amount = transaction.outputMap[firstKey]; // 11

                    // // Identify the recipient's public key and amount
                    // const recipientPublicKey = Object.keys(transaction.outputMap).find(key => key !== transaction.input.address);
                    // const amount = transaction.outputMap[recipientPublicKey];

                    // Find the recipient user by their public key
                    const recipientUser = await UserModel.findOne({ publicKey: firstKey });

                    if (recipientUser) {
                        // Add the transaction amount to the recipient's balance
                        // recipientUser.balance += amount;
                        amount = parseInt(amount, 10); // Change const to let
                        if (typeof recipientUser.balance !== 'number'){
                            console.error("Error: recipientUser.balance must be integer.");
                        } else if (typeof amount !== 'number') {
                            console.error("Error: amount must be integer.");
                        } else {
                            recipientUser.balance += amount;
                        }
                        
                        await recipientUser.save();

                        console.log(`Added ${amount} to ${recipientUser.username}'s balance. New balance: ${recipientUser.balance}`);
                    } else {
                        console.error(`Recipient user with public key ${recipientPublicKey} not found.`);
                    }

                    // Adjust the balance by subtracting the reserved amount from the current user
                    balanceAdjustment -= reservedAmount;
                }
                } else if (transactionPoolMap[transactionId]) {
                    console.log(`Transaction ID ${transactionId} found in the transaction pool. Keeping in reserved transactions.`);
                    transactionsToKeep.push(reservedTransaction);
                } else {
                    console.log(`Transaction ID ${transactionId} not found in blocks or transaction pool. Removing from reserved transactions without adjusting balance.`);
                }
            }
    
            user.reservedTransactions = transactionsToKeep;
            user.balance += balanceAdjustment;
    
            await user.save();
            console.log(`Reconciliation completed for user ${username}. New balance: ${user.balance}`);
    
        } catch (error) {
            console.error(`Error reconciling reserved transactions for user ${username}:`, error);
        }
    }
    
    // Function to reconcile all users' reserved transactions
    static async reconcileAllUsersReservedTransactions() {
        try {
            // Fetch all users from the database
            const users = await UserModel.find();
    
            console.log(`Found ${users.length} users.`);
    
            // Iterate over each user and apply the reconciliation function
            for (const user of users) {
                console.log(`Starting reconciliation for user: ${user.username}`);
                await this.reconcileUserReservedTransactions(user.username);
            }
    
            console.log('Reconciliation completed for all users.');
        } catch (error) {
            console.error('Error fetching users or reconciling transactions:', error);
        }
    }
    
}

module.exports = Transaction;