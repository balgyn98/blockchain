const Transaction = require('./transaction')
const { STARTING_BALANCE } = require('../config');
const { ec, cryptoHash } = require('../util');

class Wallet {
    // constructor(){
    //     this.balance = STARTING_BALANCE;

    //     this.keyPair = ec.genKeyPair();

    //     this.publicKey = this.keyPair.getPublic().encode('hex');
    // }

    constructor({ publicKey, keyPair, balance } = {}) {
        if (keyPair) {
            this.keyPair = keyPair;
            this.publicKey = publicKey || this.keyPair.getPublic('hex'); // Use provided publicKey or derive from keyPair
        } else {
            // If no keyPair is provided, generate a new one
            this.keyPair = ec.genKeyPair();
            this.publicKey = this.keyPair.getPublic('hex');
        }
        
        this.balance = balance || STARTING_BALANCE; // Use provided balance or default to STARTING_BALANCE
    }

    sign(data) {
        return this.keyPair.sign(cryptoHash(data))
    }

    createTransaction({recipient, amount, chain, wallet, totalReservedAmount}){

        // if(chain){
        //     this.balance = Wallet.calculateBalance({
        //         chain,
        //         address: this.publicKey
        //     });
        // }
    

        if(amount > wallet.balance - totalReservedAmount){
            throw new Error('Amount exceeds balance');
        }

        console.log("recipient info = ", recipient);


        return new Transaction({ senderWallet: wallet, recipient, amount});
    }

    static calculateBalance({chain, address}){
        let hasConductedTransaction = false;
        let outputsTotal = 0;

        for(let i=chain.length-1; i>0; i--){
            const block = chain[i];

            for(let transaction of block.data){

                if(transaction.input.address === address){
                    hasConductedTransaction = true;
                }

                const addressOutput = transaction.outputMap[address];

                if(addressOutput){
                    outputsTotal = outputsTotal + addressOutput;
                }
            }

            if(hasConductedTransaction){
                break;
            }
        }

        return hasConductedTransaction? outputsTotal: STARTING_BALANCE + outputsTotal;
    }
};

module.exports = Wallet;