const express = require('express');
const dotenv = require('dotenv').config();

const app = express();
const port = 3000;

app.use(express.static("public"));
console.log(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET);

app.listen(process.env.PORT || port, () => {
  console.log('App listening on port', process.env.PORT || port);
});