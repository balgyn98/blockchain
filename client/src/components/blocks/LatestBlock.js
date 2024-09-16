import React, { Component } from 'react';
import axios from 'axios';
import Navbar from './Navbar'; // Import the Navbar component if you have one
import './style/LatestBlock.css';

class LatestBlocks extends Component {
    constructor(props) {
        super(props);
        this.state = {
            blocks: []
        };
    }

    componentDidMount() {
        axios.get('/api/blocks')
            .then(response => {
                this.setState({ blocks: response.data });
            })
            .catch(error => {
                console.error('Error fetching blocks:', error);
            });
    }

    render() {
        const { blocks } = this.state;

        return (
            <div className="latest-blocks-page">
                <Navbar /> {/* Include Navbar here if needed */}
                <div className="latest-blocks-container">
                    <div className="latest-blocks-table-container">
                        <table className="latest-blocks-table">
                            <thead>
                                <tr>
                                    <th>LastHash</th>
                                    <th>Timestamp</th>
                                    <th>Transactions</th>
                                    <th>Nonce</th>
                                    <th>Difficulty</th>
                                </tr>
                            </thead>
                            <tbody>
                                {blocks.map(block => (
                                    <tr key={block.id}>
                                        <td>{block.lastHash}</td>
                                        <td>{new Date(block.timestamp).toLocaleString()}</td>
                                        <td>{block.data ? block.data.length : 0}</td>
                                        <td>{block.nonce}</td>
                                        <td>{block.difficulty}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }
}

export default LatestBlocks;
