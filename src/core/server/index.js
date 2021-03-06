import express from 'express';
import path, {resolve} from 'path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { match, RouterContext } from 'react-router';
import graphqlHTTP from 'express-graphql';
import { ApolloClient, ApolloProvider, createNetworkInterface, getDataFromTree } from 'react-apollo';

import Plugin from '../plugin';
import schemaModel from '../../plugins/schema/db/schema.db';
import EditorSchema from '../db/schema';
import Html from '../system/components/Html';
import App from '../system/components/App';
import store from '../../store';

const app = express();

app.use(require('cookie-parser')());
app.use(require('body-parser').urlencoded({ extended: true }));
app.use(require('body-parser').json());
app.use('/css', express.static(path.join(__dirname, '../../../public/css')));
app.use('/js', express.static(resolve(__dirname, '../../../public/js')));

const port = process.env.PORT || 3000;
const networkInterface = createNetworkInterface({
  uri: `http://localhost:${port}/graphql`,
});
const client = new ApolloClient({
    networkInterface
});

// Only works on the Server for now. Need to make it isomorphic.
const plugin = new Plugin();
const loadedRoutes = plugin.loadType('routes');

const routes = {
  path: '/',
  component: App,
  childRoutes: []
};

loadedRoutes.forEach((r) => {
  r.forEach((i) => {
    routes.childRoutes.push(i);
  });
});

app.get('/api/schema', function (req, res) {
  schemaModel.findAll().then((schemas) => {
    res.json(schemas);
  });
});

app.get('/api/schema/:schema', function (req, res) {
  schemaModel.findAll({where: {name: req.params.schema}}).then((schemas) => {
    res.json(schemas.shift());
  });
});

app.post('/api/schema', function (req, res) {
  let schema = {};
  schema.name = req.body.data.name;
  schema.label = req.body.data.label;
  schema.form_schema = req.body.schema;
  schema.ui_schema = req.body.uiSchema;
  schemaModel.create(schema).then((schema) => {
    res.json(schema);
  });
});

// GraphQL support.
app.use('/graphql', graphqlHTTP({
  schema: EditorSchema,
  graphiql: true
}));

// Server Side Render.
app.get('*', function (req, res) {
  match({routes, location: req.url }, (error, redirectLocation, renderProps) => {
    if (renderProps) {
      const app = (
        <ApolloProvider store={store}  client={client}>
          <RouterContext {...renderProps} />
        </ApolloProvider>
      );

      getDataFromTree(app).then(() => {
        const content = renderToString(app);

        const html = (
          <Html content={content} />
        );

        const output = renderToString(html);
        // It's impossible to get <!doctype html> in react :-|.
        res.status(200).send('<!DOCTYPE html>' + output);
      });
    }
    else {
      res.status(404).send('Not found');
    }
  });
});

module.exports = app;
