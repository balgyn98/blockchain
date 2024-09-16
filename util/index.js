const EC = require('elliptic').ec;
const cryptoHash = require('./crypto-hash');

const ec = new EC('secp256k1');

const verifySignature = ({ publicKey, data, signature }) => {
    const keyFromPublic = ec.keyFromPublic(publicKey, 'hex');
    const dataHash = cryptoHash(data);

    return keyFromPublic.verify(dataHash, signature);
};

module.exports = { ec, verifySignature, cryptoHash};