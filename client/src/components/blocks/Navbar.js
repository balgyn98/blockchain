import React, { Component } from 'react';
import './style/Navbar.css';
import { NavLink } from 'react-router-dom';

class Navbar extends Component {
    render() {
        return (
            <nav>
                        <h3> Blockchain Explorer </h3>
              <ul>
                <NavLink exact to="/" activeClassName="active">Blocks</NavLink>
                {/* <NavLink to="/" activeClassName="active">Blocks</NavLink> */}
                <NavLink to="/transactions" activeClassName="active">Transactions</NavLink>
                <NavLink to="/difficulty" activeClassName="active">Set Difficulty</NavLink>
                {/* Add more links as needed */}
              </ul>
            </nav>
        );
    }
}

export default Navbar;
