import React from 'react';
import {render} from 'react-dom';
import {Router, Switch, Route} from 'react-router-dom';
import history from './components/history';
import App from './components/App';

import './index.css';


render( 
    <Router history={history}>
        <Switch>
            <Route exact path='/' component={App}/>
        </Switch>
    </Router>,
    document.getElementById('root')
);