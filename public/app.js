const pushCheckbox = document.querySelector('.js-push-toggle-checkbox');

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

//注册workservice
function registerServiceWorker() {
  return navigator.serviceWorker.register('service-worker.js')
  .then(function(registration) {
    console.log('Service worker successfully registered.');
    return registration;
  })
  .catch(function(err) {
    console.error('Unable to register service worker.', err);
  });
}

//获取workservice对象实例
function getSWRegistration() {
  return navigator.serviceWorker.register('service-worker.js');
}

//请求通知权限
function askPermission() {
  return new Promise(function(resolve, reject) {
    const permissionResult = Notification.requestPermission(function(result) {
      resolve(result);
    });

    if (permissionResult) {
      permissionResult.then(resolve, reject);
    }
  })
  .then(function(permissionResult) {
    if (permissionResult !== 'granted') {
      throw new Error('We weren\'t granted permission.');
    }
  });
}

//获取通知权限结果
function getNotificationPermissionState() {
  if (navigator.permissions) {
    return navigator.permissions.query({name: 'notifications'})
    .then((result) => {
      return result.state;
    });
  }

  return new Promise((resolve) => {
    resolve(Notification.permission);
  });
}

//取消订阅
function unsubscribeUserFromPush() {
  return registerServiceWorker()
    .then(function(registration) {
      return registration.pushManager.getSubscription();
    })
    .then(function(subscription) {
      if (subscription) {
        subscription.unsubscribe();
        return subscription
      }
    })
    .then(function(subscription) {
      pushCheckbox.disabled = false;
      pushCheckbox.checked = false;
      return subscription
    })
    .catch(function(err) {
      console.error('Failed to subscribe the user.', err);
      getNotificationPermissionState()
      .then((permissionState) => {
        pushCheckbox.disabled = permissionState === 'denied';
        pushCheckbox.checked = false;
      });
    });
}

//发送订阅信息到后端
function sendSubscriptionToBackEnd(subscription) {
  return fetch('/api/save-subscription/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(subscription)
  })
  .then(function(response) {
    if (!response.ok) {
      throw new Error('Bad status code from server.');
    }

    return response.json();
  })
  .then(function(responseData) {
    if (!(responseData.data && responseData.data.success)) {
      throw new Error('Bad response from server.');
    }
  });
}

//用户订阅
function subscribeUserToPush() {
  return getSWRegistration()
  .then(function(registration) {
    const subscribeOptions = {
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
      )
    };

    return registration.pushManager.subscribe(subscribeOptions);
  })
  .then(function(pushSubscription) {
    console.log('Received PushSubscription: ', JSON.stringify(pushSubscription));
    return pushSubscription;
  });
}

//初始化
function setUpPush() {
  return Promise.all([
    registerServiceWorker(),
    getNotificationPermissionState()
  ])
  .then(function(results) {
    const registration = results[0];
    const currentPermissionState = results[1];

    if (currentPermissionState === 'denied') {
      console.warn('The notification permission has been blocked. Nothing we can do.');
      pushCheckbox.disabled = true;
      return;
    }

    pushCheckbox.addEventListener('change', function(event) {
      event.target.disabled = true;

      if (event.target.checked) {
        let promiseChain = Promise.resolve();
        if (currentPermissionState !== 'granted') {
          promiseChain = askPermission();
        }

        promiseChain
          .then(subscribeUserToPush)
          .then(function(subscription) {
            if (subscription) {
              return sendSubscriptionToBackEnd(subscription)
              .then(function() {
                return subscription;
              });
            }

            return subscription;
          })
          .then(function(subscription) {
            pushCheckbox.disabled = false;
            pushCheckbox.checked = subscription !== null;
          })
          .catch(function(err) {
            console.error('Failed to subscribe the user.', err);

            pushCheckbox.disabled = currentPermissionState === 'denied';
            pushCheckbox.checked = false;
          });
      } else {
        unsubscribeUserFromPush().then((subscription) => {
          return fetch('/api/remove-subscription/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(subscription)
          })
          .then(() => {
            alert('unsubscribe success')
          })
          .catch((err) => {
            console.log(err)
          })
        })
      }
    });

    if (currentPermissionState !== 'granted') {
      pushCheckbox.disabled = false;
      return;
    }

    return registration.pushManager.getSubscription()
    .then(function(subscription) {
      pushCheckbox.checked = subscription !== null;
      pushCheckbox.disabled = false;
    });
  })
  .catch(function(err) {
    console.log('Unable to register the service worker: ' + err);
  });
}

window.onload = function() {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  if (!('PushManager' in window)) {
    return;
  }
  setUpPush();
};
