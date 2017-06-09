const webpush = require('web-push');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const Datastore = require('nedb');

const gcmServerKey = 'AIzaSyC5itnz9jHmpvQRhq8sJUCFUy2SYUPanGs';
webpush.setGCMAPIKey(gcmServerKey);

const vapidKeys = {
  publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
  privateKey: 'UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls'
};

webpush.setVapidDetails(
  'mailto:www@huangq427.cn',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

const db = new Datastore({
  filename: path.join(__dirname, 'subscription-store.db'),
  autoload: true
});

function saveSubscriptionToDatabase(subscription) {
  return new Promise(function(resolve, reject) {
    db.insert(subscription, function(err, newDoc) {
      if (err) {
        reject(err);
        return;
      }

      resolve(newDoc._id);
    });
  });
};

function getSubscriptionsFromDatabase() {
  return new Promise(function(resolve, reject) {
    db.find({}, function(err, docs) {
      if (err) {
        reject(err);
        return;
      }

      resolve(docs);
    })
  });
}

function deleteSubscriptionFromDatabase(subscription) {
  return new Promise(function(resolve, reject) {
  db.remove({endpoint: subscription.endpoint }, {}, function(err) {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

const isValidSaveRequest = (req, res) => {
  if (!req.body || !req.body.endpoint) {
    // 非法的Subscription.
    res.status(400);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({
      error: {
        id: 'no-endpoint',
        message: 'Subscription must have an endpoint.'
      }
    }));
    return false;
  }
  return true;
};

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.text());

//保存订阅信息
app.post('/api/save-subscription/', function (req, res) {
  if (!isValidSaveRequest(req, res)) {
    return;
  }

  return saveSubscriptionToDatabase(req.body)
  .then(function(subscriptionId) {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ data: { success: true } }));
  })
  .catch(function(err) {
    res.status(500);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({
      error: {
        id: 'unable-to-save-subscription',
        message: 'The subscription was received but we were unable to save it to our database.'
      }
    }));
  });
});

//获取订阅列表
app.post('/api/get-subscriptions/', function (req, res) {

  return getSubscriptionsFromDatabase()
  .then(function(subscriptions) {
    const reducedSubscriptions = subscriptions.map((subscription) => {
      return {
        id: subscription._id,
        endpoint: subscription.endpoint
      }
    });

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ data: { subscriptions: reducedSubscriptions } }));
  })
  .catch(function(err) {
    res.status(500);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({
      error: {
        id: 'unable-to-get-subscriptions',
        message: 'We were unable to get the subscriptions from our database.'
      }
    }));
  });
});

//删除订阅信息
app.post('/api/remove-subscription/', function(req, res) {
  if (!isValidSaveRequest(req, res)) {
    return;
  }
  return deleteSubscriptionFromDatabase(req.body)
  .then(() => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({data: {success: true}}));
  })
  .catch((err) => {
    console.log(err)
  })

})

const triggerPushMsg = function(subscription, dataToSend) {
  return webpush.sendNotification(subscription, dataToSend)
  .catch((err) => {
    if (err.statusCode === 410) {
      return deleteSubscriptionFromDatabase(subscription);
    } else {
      console.log('Subscription is no longer valid: ', err);
    }
  });
};

//推送消息
app.post('/api/trigger-push-msg/', function (req, res) {
  const dataToSend = JSON.stringify(req.body);

  return getSubscriptionsFromDatabase()
  .then(function(subscriptions) {
    let promiseChain = Promise.resolve();

    for (let i = 0; i < subscriptions.length; i++) {
      const subscription = subscriptions[i];
      // deleteSubscriptionFromDatabase(subscription)

      promiseChain = promiseChain.then(() => {
        return triggerPushMsg(subscription, dataToSend);
      });
    }

    return promiseChain;
  })
  .then(() => {
    res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({ data: { success: true } }));
  })
  .catch(function(err) {
    res.status(500);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({
      error: {
        id: 'unable-to-send-messages',
        message: `We were unable to send messages to all subscriptions : ` +
          `'${err.message}'`
      }
    }));
  });
});

const port = process.env.PORT || 3000;

const server = app.listen(port, function () {
  console.log('Running on http://localhost:' + port);
});
