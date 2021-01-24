const multer = require('multer');
const path = require('path');
const fs = require('fs');
const request = require('request');
const express = require('express');
const dotenv = require('dotenv').config();
const bodyParser = require('body-parser');
// const bodyParser = require('body-parser');
// const clientoauth2 = require('client-oauth2');
const { ClientCredentials, ResourceOwnerPassword, AuthorizationCode } = require('simple-oauth2');


let db = [];
let authtoken = 'A21AALTx__Oo4oAAZm7gTAYuYYLoVI7s-4yuXwMY3bNUNoef8kuZ64qS4DPR85BbT9dEGUeKkqF-tx2qTjx_CkPNWvKhETgNg';
const port = 3000;
const app = express();

// let paypalAuth = new clientoauth2({
// 	clientId: process.env.PAYPAL_CLIENT_ID,
// 	clientSecret: process.env.PAYPAL_CLIENT_SECRET,
// 	accessTokenUri: 'https://api-m.sandbox.paypal.com/v1/oauth2/token',
// });

const config = {
  client: {
    id: process.env.PAYPAL_CLIENT_ID,
    secret: process.env.PAYPAL_CLIENT_SECRET,
  },
  auth: {
    tokenHost: 'https://api-m.sandbox.paypal.com/v1/oauth2/token',
  }
};

// const upload = multer({
  // dest: __dirname + "/tempfiles"
// });
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
	db.push(data);
	res.sendFile('public/success.html', {root: __dirname});
});

app.post('/pay', upload.single("file"), (req, res) => {
	const tempPath = req.file.path;
    const targetPath = path.join(__dirname, "./uploads/image.png");

    if (path.extname(req.file.originalname).toLowerCase() === ".png") {
        getPlateInfo(tempPath);
    } else {
      fs.unlink(tempPath, err => {
        if (err) return handleError(err, res);
        res
          .status(403)
          .contentType("text/plain")
          .end("Only .png files are allowed!");
      });
    }

	PayPayPal(data.payee, res, data.amount ? data.amount : '100.00');
});

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

const getPlateInfo = (filename) => {
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
		console.log(body);
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
                    "payee": {
                        "email_address": payee
                    },
                    "payment_instruction": {
                        "disbursement_mode": "INSTANT",
                        "platform_fees": [{
                            "amount": {
                                "currency_code": "USD",
                                "value": "25.00"
                            }
                        }]
                    }
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
            res.json({
                id: body.id
            });
        });
}

app.listen(process.env.PORT || port, () => {
  console.log('App listening on port', process.env.PORT || port);
});