import React, { Component } from 'react';
import Navbar from './blocks/Navbar';
import LatestBlocks from './blocks/LatestBlock';
import TransactionPool from './blocks/TransactionPool';
import SetDifficulty from './blocks/SetDifficulty';
import './blocks/style/HomePage.css';

class HomePage extends Component {
    render() {
        return (
            <div className="homepage">
                <div className="content">
                    <LatestBlocks />
                    {/* <TransactionPool />
                    <SetDifficulty /> */}
                </div>
            </div>
        );
    }
}

export default HomePage;
