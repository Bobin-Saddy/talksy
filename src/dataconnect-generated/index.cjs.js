const { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'example',
  service: 'talksy',
  location: 'us-east4'
};
exports.connectorConfig = connectorConfig;

const listAllNotificationsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllNotifications');
}
listAllNotificationsRef.operationName = 'ListAllNotifications';
exports.listAllNotificationsRef = listAllNotificationsRef;

exports.listAllNotifications = function listAllNotifications(dc) {
  return executeQuery(listAllNotificationsRef(dc));
};

const getUserNotificationsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserNotifications', inputVars);
}
getUserNotificationsRef.operationName = 'GetUserNotifications';
exports.getUserNotificationsRef = getUserNotificationsRef;

exports.getUserNotifications = function getUserNotifications(dcOrVars, vars) {
  return executeQuery(getUserNotificationsRef(dcOrVars, vars));
};

const createNotificationRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateNotification', inputVars);
}
createNotificationRef.operationName = 'CreateNotification';
exports.createNotificationRef = createNotificationRef;

exports.createNotification = function createNotification(dcOrVars, vars) {
  return executeMutation(createNotificationRef(dcOrVars, vars));
};

const updateNotificationStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateNotificationStatus', inputVars);
}
updateNotificationStatusRef.operationName = 'UpdateNotificationStatus';
exports.updateNotificationStatusRef = updateNotificationStatusRef;

exports.updateNotificationStatus = function updateNotificationStatus(dcOrVars, vars) {
  return executeMutation(updateNotificationStatusRef(dcOrVars, vars));
};
