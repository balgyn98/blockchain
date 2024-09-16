const bodyParser = require('body-parser')
const express = require('express');
const request = require('request');
const path = require('path');
const Blockchain = require('./blockchain');
const PubSub = require('./app/pubsub');
const TransactionPool = require('./wallet/transaction-pool');
const TransactionWallet = require('./wallet/transaction');
const Wallet = require('./wallet');
const TransactionMiner = require('./app/transaction-miner');
const redis = require('redis');
const User = require('./models/user');
const Transaction = require('./models/transaction');
const TransactionPoolModel = require('./models/transactionPool');
const BlockModel = require('./models/block');

const fs = require('fs');

const { ec, cryptoHash } = require('./util');

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();

const blockchain = new Blockchain();

const transactionPool = new TransactionPool();
const wallet = new Wallet();
const pubsub = new PubSub({ blockchain, transactionPool });
const transactionMiner = new TransactionMiner({ blockchain, transactionPool, wallet, pubsub});
const cors = require('cors');

const axios = require('axios');
const DEFAULT_PORT = 3000;
const ROOT_NODE_ADDRESS = `http://localhost:${DEFAULT_PORT}`;

//  setTimeout( () => pubsub.broadcastCHain(), 1000);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'client/dist')));

// app.js
const connectDB = require('./db');

app.get('/api/user-balance', async (req, res) => {
    try {
        // Extract the token from the Authorization header
        const token = req.headers.authorization && req.headers.authorization.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Verify the token and extract the user data
        const decoded = jwt.verify(token, SECRET_KEY);
        const username = decoded.username;

        // Retrieve user data from MongoDB
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const totalReservedAmount = user.reservedTransactions.reduce((total, transaction) => {
            return total + transaction.reservedAmount;
        }, 0);
        
        // Return the user's balance and reserved balance
        res.json({
            balance: user.balance,
            reservedBalance: totalReservedAmount
        });
    } catch (error) {
        console.error('Error fetching user balance:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


// API to get user wallet information
app.get('/user/:username/wallet', async (req, res) => {
    const { username } = req.params;

    try {
        // Find the user by username
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Respond with the public key and balance
        res.json({
            publicKey: user.publicKey,
            balance: user.balance
        });
    } catch (err) {
        console.error('Error fetching user wallet info:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

async function getUserTransactions(publicKey) {

    try {        
        const response = await axios.get(`http://localhost:3000/api/user-transactions/${publicKey}`);

        return response.data; // The transactions
    } catch (error) {
        console.error('Error fetching user transactions:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        } else if (error.request) {
            console.error('No response received:', error.request);
        } else {
            console.error('Error setting up request:', error.message);
        }
        
        throw error;
    }
}


const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(403).send('A token is required for authentication');
    }

    jwt.verify(token.split(' ')[1], SECRET_KEY, (err, decoded) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).send('Token has expired');
            } else {
                return res.status(401).send('Invalid Token');
            }
        }

        req.user = decoded;
        next();
    });
};


app.get('/protected', verifyToken, (req, res) => {
    res.send(`Hello ${req.user.username}, you have access to this route!`);
});


// app.get('/api/blocks', (req, res) => {
//     res.json(blockchain.chain);
// });

app.get('/api/blocks', async (req, res) => {
    try {
        // Fetch all blocks from the MongoDB collection
        const blocks = await BlockModel.find().sort({ timestamp: 1 });
    
        // Respond with the blocks in JSON format
        res.json(blocks);
    } catch (error) {
        console.error('Error fetching blocks from MongoDB:', error);
        res.status(500).json({ error: 'An error occurred while fetching blocks' });
    }
});


app.post('/api/mine', (req, res) => {
    const {data} = req.body;

    blockchain.addBlock({ data });

    pubsub.broadcastCHain();

    res.redirect('/api/blocks');
});


app.post('/api/transact', async (req, res) => {
    const { amount, recipient } = req.body;

    // Extract the token from the Authorization header
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];

    if (!token) {
        return res.status(401).json({ type: 'error', message: 'Unauthorized' });
    }

    try {
        let transactionPl = await TransactionPoolModel.findOne();
    

        if (!transactionPl || transactionPl.transactionMap.size == 0) {
            transactionPl = new TransactionPoolModel();
            transactionPl.transactionMap = {};
        }

        const decoded = jwt.verify(token, SECRET_KEY);
        const username = decoded.username;

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ type: 'error', message: 'User not found' });
        }

        const rec = await User.findOne({ username: recipient });
        if (!rec) {
            return res.status(404).json({ type: 'error', message: 'User not found' });
        }

        const keyPair = ec.keyFromPrivate(user.privateKey, 'hex');
        
        const wallet = new Wallet({
            publicKey: user.publicKey,
            keyPair: keyPair,
            balance: user.balance
        });

        let transaction = await transactionPl.existingTransaction({ inputAddress: wallet.publicKey });

        const totalReservedAmount = user.reservedTransactions.reduce((total, transaction) => {
            return total + transaction.reservedAmount;
        }, 0);


        if (transaction) {
            if (wallet && rec.publicKey && amount) {
                transaction.update({ senderWallet: wallet, recipient: rec.publicKey, amount, totalReservedAmount });
            } else {
                console.error('Error: Missing required data for transaction update.');
            }
        } else {
            if (wallet && rec.publicKey && amount && blockchain.chain) {
                transaction = wallet.createTransaction({ recipient: rec.publicKey, amount, chain: blockchain.chain, wallet, totalReservedAmount });
            } else {
                console.error('Error: Missing required data for creating transaction.');
            }
        }

        console.log("created transaction = ", transaction);

        user.reservedTransactions.push({
            transactionId: transaction.id,
            reservedAmount: amount
        });

        await user.save();

        transactionPl.setTransaction(transaction);

        pubsub.broadcastTransaction(transaction);

        res.json({ type: 'success', transaction });
    } catch (error) {
        console.error('Error during transaction:', error.message);
        return res.status(500).json({ type: 'error', message: 'Server error' });
    }
});

app.get('/api/transaction-pool-map', async (req, res) => {
    try {
        // Fetch the transaction pool document from MongoDB
        let transactionPool = await TransactionPoolModel.findOne();
        if (!transactionPool || !transactionPool.transactionMap) {
            return res.status(404).json({ message: 'Transaction pool not found' });
        }

        // Send the transactionMap as a JSON response
        res.json(transactionPool.transactionMap);
    } catch (error) {
        console.error('Error fetching transaction pool from MongoDB:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/transaction-pool-map-by-user', async (req, res) => {
    try {
        // Extract the token from the Authorization header
        const token = req.headers.authorization && req.headers.authorization.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Verify the token and extract the user data
        const decoded = jwt.verify(token, SECRET_KEY);
        // const userPublicKey = decoded.username; // Assuming the public key is stored in the token

        const user = await User.findOne({ username: decoded.username });
        const userPublicKey = user.publicKey;

        // Fetch the transaction pool document from MongoDB
        let transactionPool = await TransactionPoolModel.findOne();
        if (!transactionPool || !transactionPool.transactionMap) {
            return res.status(404).json({ message: 'Transaction pool not found' });
        }

        const transactionsArray = Array.from(transactionPool.transactionMap.values());

       // Filter transactions where the sender is the authorized user
       const filteredTransactions = transactionsArray.filter(transaction => {
            const isUserSender = transaction.input.address === userPublicKey;
            return isUserSender;
    });
        // Send the filtered transactions as a JSON response
        res.json(filteredTransactions);
    } catch (error) {
        console.error('Error fetching transaction pool from MongoDB:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


app.get('/api/blockchain-transactions-by-user', async (req, res) => {
    try {
        // Extract the token from the Authorization header
        const token = req.headers.authorization && req.headers.authorization.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Verify the token and extract the username
        const decoded = jwt.verify(token, SECRET_KEY);
        const username = decoded.username;

        // Fetch the user's public key from the UserModel
        const user = await User.findOne({ username: username });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const publicKey = user.publicKey;

        // Fetch all blocks from the blockchain
        const blocks = await BlockModel.find({});
        const userTransactions = [];

        // Iterate over each block and extract transactions involving the user's public key
        blocks.forEach(block => {
            block.data.forEach(transaction => {
                if (transaction.input.address === publicKey || transaction.outputMap[publicKey]) {
                    userTransactions.push({ ...transaction, status: 'sent' });
                }
            });
        });

        // Send the user's transactions as a JSON response
        res.json(userTransactions);
    } catch (error) {
        console.error('Error fetching blockchain transactions:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// API to collect all transactions where the user is the receiver
app.get('/api/transactions/receiver', async (req, res) => {
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    // Verify the token and extract the username
    const decoded = jwt.verify(token, SECRET_KEY);
    const username = decoded.username;

    try {
        // Find the user by username or public key stored in the token
        const user = await User.findOne({ username: username });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const publicKey = user.publicKey;

        // Find all blocks that contain transactions where the user is the receiver
        const blocks = await BlockModel.find({ 'data.outputMap': { $elemMatch: { [publicKey]: { $exists: true } } } });

        let userTransactions = [];

        // Extract transactions where the user is the receiver
        blocks.forEach(block => {
            block.data.forEach(transaction => {
                if (transaction.outputMap[publicKey]) {
                    userTransactions.push(transaction);
                }
            });
        });

        res.json(userTransactions);
    } catch (error) {
        console.error('Error fetching transactions for receiver:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


app.get('/api/mine-transactions', async (req, res) => {
    console.log("Headers: ", req.headers);

    // Extract the token from the Authorization header
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];

    if (!token) {
        return res.status(401).json({ type: 'error', message: 'Unauthorized: Token not found' });
    }

    try {
        // Verify the token and extract the user data
        const decoded = jwt.verify(token, SECRET_KEY);
        const username = decoded.username;

        // Retrieve user data from MongoDB
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ type: 'error', message: 'User not found' });
        }
        await transactionMiner.mineTransactions(user);

        TransactionWallet.reconcileAllUsersReservedTransactions().then(() => {
            console.log('Reconciliation process for all users completed.');
        }).catch(error => {
            console.error('Error during the reconciliation process:', error);
        });

        res.redirect('/api/blocks');
    } catch (error) {
        console.error('Error mining transactions:', error);
        res.status(500).send('Error mining transactions');
    }
});

app.get('/api/wallet-info', (req, res) => {
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Verify the token and extract the user data
        const decoded = jwt.verify(token, SECRET_KEY);
        const username = decoded.username;

        // Retrieve the user information from Redis
        redisClient.get(`user:${username}`, (err, result) => {
            if (err || !result) {
                return res.status(404).json({ error: 'User not found' });
            }

            const user = JSON.parse(result);
            const address = user.publicKey;

            // Calculate the balance using the separate function
            const balance = Wallet.calculateBalance({ chain: blockchain.chain, address });

            // Respond with the wallet info
            res.json({
                address,
                balance
            });
        });
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
});



app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});


const syncWithRootState = () => {
    request({ url: `${ROOT_NODE_ADDRESS}/api/blocks` }, (error, response, body) => {
        if(!error && response.statusCode === 200) {
            const rootChain = JSON.parse(body);

            console.log('replace chain on a sync with', rootChain);
            blockchain.replaceChain(rootChain);
        }
    });

    request({ url: `${ROOT_NODE_ADDRESS}/api/transaction-pool-map`}, (error, response, body) => {
        if(!error && response.statusCode === 200){
            const rootTransactionPoolMap = JSON.parse(body);

            console.log('replace transaction pool map on a sync with', rootTransactionPoolMap);

            transactionPool.setMap(rootTransactionPoolMap);


        }
    });
};

let PEER_PORT;

if(process.env.GENERATE_PEER_PORT === 'true'){
    PEER_PORT = DEFAULT_PORT + Math.ceil(Math.random() * 1000);
}

const PORT = PEER_PORT || DEFAULT_PORT;
app.listen(PORT, () => {
    
    console.log(`listening at localhost: ${PORT}`)

    if(PORT !== DEFAULT_PORT){
        syncWithRootState();
    }
});

// // Use a secret key to sign the JWT (this should be stored securely)
const SECRET_KEY = 'sussex2024';

app.use(cors());
app.use(express.json());

const redisClient = redis.createClient();

redisClient.on('connect', () => {
    console.log('Connected to Redis...');
});

redisClient.on('error', (err) => {
    console.error('Redis error:', err);
});


// Registration API
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Check if the user already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).send('User already exists');
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 8);

        // Create a new wallet for the user
        const wallet = new Wallet();


        // Create a new user instance with the hashed password and wallet information
        const newUser = new User({
            username,
            password: hashedPassword,
            publicKey: wallet.publicKey,
            privateKey: wallet.keyPair.getPrivate('hex'),
            balance: wallet.balance  // Initial balance
        });

        // Save the user in MongoDB
        await newUser.save();

        res.status(201).send('User registered successfully');
    } catch (err) {
        console.error('Error during registration:', err.message);
        res.status(500).send('Server error');
    }
});

// Login API
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Retrieve user data from MongoDB
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(400).send('Invalid username or password');
        }

        // Compare the password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).send('Invalid username or password');
        }

        // Generate a JWT
        const token = jwt.sign({ username: user.username }, SECRET_KEY, { expiresIn: '1h' });

        // Optionally, you can store the token in Redis with an expiration if needed
        // redisClient.set(`token:${token}`, username, 'EX', 3600);

        res.json({ token });
    } catch (err) {
        console.error('Error during login:', err.message);
        res.status(500).send('Server error');
    }
});

app.post('/signout', (req, res) => {
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];

    if (!token) {
        return res.status(400).json({ message: 'No token provided' });
    }
    return res.status(200).json({ message: 'Sign out successful' });
});


app.post('/api/users', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        let user = new User({ username, email, password });
        await user.save();
        res.status(201).json({ message: 'User created successfully', user });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/update-difficulty', (req, res) => {
    const { difficulty } = req.body;

    // Validate the difficulty input
    if (typeof difficulty !== 'number' || difficulty < 1) {
        return res.status(400).json({ message: 'Invalid difficulty value' });
    }

    // Update the difficulty in the config file
    const configPath = './config.js';
    
    // Read the config file
    let configContent;
    try {
        configContent = fs.readFileSync(configPath, 'utf8');
    } catch (err) {
        return res.status(500).json({ message: 'Error reading config file', error: err.message });
    }

    const newConfigContent = configContent.replace(/(INITIAL_DIFFICULTY\s*=\s*)\d+/, `$1${difficulty}`);

    try {
        fs.writeFileSync(configPath, newConfigContent, 'utf8');
        console.log('Config file updated:', newConfigContent);
        res.status(200).json({ message: `Difficulty set to ${difficulty}.` });
    } catch (err) {
        return res.status(500).json({ message: 'Error writing config file', error: err.message });
    }
});


connectDB();

app.use(express.json());

app.get('/', (req, res) => {
    res.send('API is running...');
});
