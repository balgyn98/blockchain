import React, { Component } from 'react';
import axios from 'axios';
import Navbar from './Navbar';
import './style/TransactionPool.css';

class TransactionPool extends Component {
    constructor(props) {
        super(props);
        this.state = {
            transactionPoolMap: {}
        };
    }

    componentDidMount() {
        axios.get('/api/transaction-pool-map')
            .then(response => {
                this.setState({ transactionPoolMap: response.data });
            })
            .catch(error => {
                console.error('Error fetching transaction pool:', error);
            });
    }

    render() {
        const { transactionPoolMap } = this.state;
        const transactionEntries = Object.entries(transactionPoolMap);

        return (
            <div>
                <Navbar />
                <div className="transaction-pool-container">
                    <div className="transaction-pool-table-container">
                        {transactionEntries.length > 0 ? (
                            <table className="transaction-pool-table">
                                <thead>
                                    <tr>
                                        <th>Transaction ID</th>
                                        <th>Amount (BTC)</th>
                                        <th>Sender</th>
                                        <th>Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactionEntries.map(([txId, tx]) => (
                                        <tr key={txId}>
                                            <td>{txId}</td>
                                            <td>{Object.values(tx.outputMap)[0]} BTC</td>
                                            <td>{tx.input.address}</td>
                                            <td>{new Date(tx.input.timestamp).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p>No transactions found in the pool.</p>
                        )}
                    </div>
                </div>
            </div>
        );
    }
}

export default TransactionPool;
