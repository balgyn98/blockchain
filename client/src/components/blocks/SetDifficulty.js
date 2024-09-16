import React, { Component } from 'react';
import axios from 'axios';
import Navbar from './Navbar'; // Import the Navbar component
import './style/SetDifficulty.css';

class SetDifficulty extends Component {
    constructor(props) {
        super(props);
        this.state = {
            difficulty: 3,
            message: ''
        };
    }

    handleSetDifficulty = () => {
        axios.post('/api/update-difficulty', { difficulty: this.state.difficulty })
            .then(response => {
                this.setState({ message: response.data.message });
            })
            .catch(error => {
                this.setState({ message: 'Error setting difficulty' });
                console.error('Error:', error);
            });
    };

    handleInputChange = (event) => {
        // Parse the input value as an integer
        const value = parseInt(event.target.value, 10);
        this.setState({ difficulty: value });
    };

    render() {
        const { difficulty, message } = this.state;

        return (
            <div>
                <Navbar /> {/* Add Navbar here */}
                <div className="set-difficulty">
                    <h3>Set Mining Difficulty</h3>
                    <input 
                        type="number" 
                        value={difficulty} 
                        onChange={this.handleInputChange} 
                        min="1"
                    />
                    <button onClick={this.handleSetDifficulty}>Set Difficulty</button>
                    {message && <p>{message}</p>}
                </div>
            </div>
        );
    }
}

export default SetDifficulty;
