import React, { Component } from "react";
import HomePage from "./HomePage";
import { BrowserRouter as Router, Route, Switch, Redirect } from 'react-router-dom';
import LatestBlocks from "./blocks/LatestBlock";
import TransactionPool from "./blocks/TransactionPool";
import SetDifficulty from "./blocks/SetDifficulty";

class App extends Component {
    render() {
        return(
            <Router>
                <Switch>
                    {/* <Route exact path="/" component={HomePage} /> */}
                    <Route  exact path="/" component={LatestBlocks} />
                    <Route  path="/transactions" component={TransactionPool} />
                    <Route  path="/difficulty" component={SetDifficulty} />
                </Switch>
            </Router>
        );

    }
}

export default App;