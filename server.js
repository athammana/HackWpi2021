const multer = require('multer');
const path = require('path');
const fs = require('fs');
const request = require('request');
const express = require('express');
const dotenv = require('dotenv').config();
const bodyParser = require('body-parser');
const { MongoClient } = require("mongodb");


let collection;
let authtoken = 'A21AALTx__Oo4oAAZm7gTAYuYYLoVI7s-4yuXwMY3bNUNoef8kuZ64qS4DPR85BbT9dEGUeKkqF-tx2qTjx_CkPNWvKhETgNg';
const mongouri = 'mongodb+srv://mongouser:'+ process.env.MONGO_PASS +'@cluster0.qjvrv.mongodb.net/<dbname>?retryWrites=true&w=majority';
const port = 3000;
const app = express();
const client = new MongoClient(mongouri);

const config = {
  client: {
    id: process.env.PAYPAL_CLIENT_ID,
    secret: process.env.PAYPAL_CLIENT_SECRET,
  },
  auth: {
    tokenHost: 'https://api-m.sandbox.paypal.com/v1/oauth2/token',
  }
};

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
  	cb(null, __dirname + "/tempfiles");
  },
  filename: function(req, file, cb) {
  	cb(null, Date.now() + '.png');
  }
});

const upload = multer({storage: storage});

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.get('/camera', (req, res) => {
	res.sendFile('public/camera.html', {root: __dirname});
});

app.post('/register', (req, res) => {
	let data = JSON.parse(JSON.stringify(req.body));
	collection.insertOne(data);
	res.sendFile('public/success.html', {root: __dirname});
});

app.post('/pay', upload.single("file"), (req, res) => {
	const tempPath = req.file.path;
    const targetPath = path.join(__dirname, "./uploads/image.png");

    if (path.extname(req.file.originalname).toLowerCase() === ".png") {
        getPlateInfo(tempPath, res);
    } else {
      fs.unlink(tempPath, err => {
        if (err) return handleError(err, res);
        res
          .status(403)
          .contentType("text/plain")
          .end("Only .png files are allowed!");
      });
    }
});

const mongoConn = async () => {
	await client.connect();
	const database = client.db('licenses');
	collection = database.collection('hackWPI');
}

mongoConn();

const handleError = (err, res) => {
  res
    .status(500)
    .contentType("text/plain")
    .end("Oops! Something went wrong!");
};

const getPaypalAuthToken = () => {
	authtoken = paypalAuth.createToken('access token', 'optional refresh token', 'optional token type', { data: 'raw user data' });
	authtoken.expiresIn(60 * 60 * 9); // 9 hours
}

const getPlateInfo = (filename, res) => {
	console.log(__dirname + filename);
	request.post('https://api.platerecognizer.com/v1/plate-reader/', {
		headers: {
			'Authorization': 'Token ' + process.env.PLATE_RECOGNIZER_APIKEY,
			'Content-Type': 'multipart/form-data',
		},
		formData: {
			'regions': 'us',
			'upload': fs.createReadStream(filename),
		},
	}, (err, response, body) => {
		body = JSON.parse(body);
		collection.findOne({lp: body.results[0].plate}, (err, doc) => {
			if (err) return errorhandler(err, req, res, next);
			if (doc) PayPayPal(doc['paypal'], res);
		});	
	});
}

const PayPayPal = (payee, res, amount = '100.00') => {
        request.post('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
            headers: {
                'Content-Type': "application/json",
                'Authorization': "Bearer " + authtoken,
            },
            body: {
                "intent": "CAPTURE",
                "purchase_units": [{
                    "amount": {
                        "currency_code": "USD",
                        "value": amount
                    },
                    "payer": {
                        "email_address": payee
                    },
                }],
            },
            json: true
        }, (err, response, body) => {
            if (err) {
                console.error(err);
                return res.sendStatus(500);
            } 

            // console.log(response)
            console.log(body)
            // res.json({
            //     id: body.id
            // });
        	res.redirect(body.links[1].href);
        });
}

app.listen(process.env.PORT || port, () => {
  console.log('App listening on port', process.env.PORT || port);
});