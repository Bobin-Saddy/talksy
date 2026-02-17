# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*ListAllNotifications*](#listallnotifications)
  - [*GetUserNotifications*](#getusernotifications)
- [**Mutations**](#mutations)
  - [*CreateNotification*](#createnotification)
  - [*UpdateNotificationStatus*](#updatenotificationstatus)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## ListAllNotifications
You can execute the `ListAllNotifications` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllNotifications(): QueryPromise<ListAllNotificationsData, undefined>;

interface ListAllNotificationsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListAllNotificationsData, undefined>;
}
export const listAllNotificationsRef: ListAllNotificationsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllNotifications(dc: DataConnect): QueryPromise<ListAllNotificationsData, undefined>;

interface ListAllNotificationsRef {
  ...
  (dc: DataConnect): QueryRef<ListAllNotificationsData, undefined>;
}
export const listAllNotificationsRef: ListAllNotificationsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllNotificationsRef:
```typescript
const name = listAllNotificationsRef.operationName;
console.log(name);
```

### Variables
The `ListAllNotifications` query has no variables.
### Return Type
Recall that executing the `ListAllNotifications` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllNotificationsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListAllNotificationsData {
  notifications: ({
    id: UUIDString;
    title: string;
    message: string;
    scheduledAt: TimestampString;
    priority?: string | null;
  } & Notification_Key)[];
}
```
### Using `ListAllNotifications`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllNotifications } from '@dataconnect/generated';


// Call the `listAllNotifications()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllNotifications();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllNotifications(dataConnect);

console.log(data.notifications);

// Or, you can use the `Promise` API.
listAllNotifications().then((response) => {
  const data = response.data;
  console.log(data.notifications);
});
```

### Using `ListAllNotifications`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllNotificationsRef } from '@dataconnect/generated';


// Call the `listAllNotificationsRef()` function to get a reference to the query.
const ref = listAllNotificationsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllNotificationsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.notifications);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.notifications);
});
```

## GetUserNotifications
You can execute the `GetUserNotifications` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getUserNotifications(vars: GetUserNotificationsVariables): QueryPromise<GetUserNotificationsData, GetUserNotificationsVariables>;

interface GetUserNotificationsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserNotificationsVariables): QueryRef<GetUserNotificationsData, GetUserNotificationsVariables>;
}
export const getUserNotificationsRef: GetUserNotificationsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserNotifications(dc: DataConnect, vars: GetUserNotificationsVariables): QueryPromise<GetUserNotificationsData, GetUserNotificationsVariables>;

interface GetUserNotificationsRef {
  ...
  (dc: DataConnect, vars: GetUserNotificationsVariables): QueryRef<GetUserNotificationsData, GetUserNotificationsVariables>;
}
export const getUserNotificationsRef: GetUserNotificationsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getUserNotificationsRef:
```typescript
const name = getUserNotificationsRef.operationName;
console.log(name);
```

### Variables
The `GetUserNotifications` query requires an argument of type `GetUserNotificationsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetUserNotificationsVariables {
  userId: UUIDString;
}
```
### Return Type
Recall that executing the `GetUserNotifications` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetUserNotificationsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetUserNotificationsData {
  notifications: ({
    id: UUIDString;
    title: string;
    message: string;
    scheduledAt: TimestampString;
    priority?: string | null;
  } & Notification_Key)[];
}
```
### Using `GetUserNotifications`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getUserNotifications, GetUserNotificationsVariables } from '@dataconnect/generated';

// The `GetUserNotifications` query requires an argument of type `GetUserNotificationsVariables`:
const getUserNotificationsVars: GetUserNotificationsVariables = {
  userId: ..., 
};

// Call the `getUserNotifications()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getUserNotifications(getUserNotificationsVars);
// Variables can be defined inline as well.
const { data } = await getUserNotifications({ userId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getUserNotifications(dataConnect, getUserNotificationsVars);

console.log(data.notifications);

// Or, you can use the `Promise` API.
getUserNotifications(getUserNotificationsVars).then((response) => {
  const data = response.data;
  console.log(data.notifications);
});
```

### Using `GetUserNotifications`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getUserNotificationsRef, GetUserNotificationsVariables } from '@dataconnect/generated';

// The `GetUserNotifications` query requires an argument of type `GetUserNotificationsVariables`:
const getUserNotificationsVars: GetUserNotificationsVariables = {
  userId: ..., 
};

// Call the `getUserNotificationsRef()` function to get a reference to the query.
const ref = getUserNotificationsRef(getUserNotificationsVars);
// Variables can be defined inline as well.
const ref = getUserNotificationsRef({ userId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getUserNotificationsRef(dataConnect, getUserNotificationsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.notifications);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.notifications);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateNotification
You can execute the `CreateNotification` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createNotification(vars: CreateNotificationVariables): MutationPromise<CreateNotificationData, CreateNotificationVariables>;

interface CreateNotificationRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateNotificationVariables): MutationRef<CreateNotificationData, CreateNotificationVariables>;
}
export const createNotificationRef: CreateNotificationRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createNotification(dc: DataConnect, vars: CreateNotificationVariables): MutationPromise<CreateNotificationData, CreateNotificationVariables>;

interface CreateNotificationRef {
  ...
  (dc: DataConnect, vars: CreateNotificationVariables): MutationRef<CreateNotificationData, CreateNotificationVariables>;
}
export const createNotificationRef: CreateNotificationRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createNotificationRef:
```typescript
const name = createNotificationRef.operationName;
console.log(name);
```

### Variables
The `CreateNotification` mutation requires an argument of type `CreateNotificationVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateNotificationVariables {
  title: string;
  message: string;
  scheduledAt: TimestampString;
  priority?: string | null;
  soundPreference?: string | null;
  vibrationPreference?: string | null;
}
```
### Return Type
Recall that executing the `CreateNotification` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateNotificationData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateNotificationData {
  notification_insert: Notification_Key;
}
```
### Using `CreateNotification`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createNotification, CreateNotificationVariables } from '@dataconnect/generated';

// The `CreateNotification` mutation requires an argument of type `CreateNotificationVariables`:
const createNotificationVars: CreateNotificationVariables = {
  title: ..., 
  message: ..., 
  scheduledAt: ..., 
  priority: ..., // optional
  soundPreference: ..., // optional
  vibrationPreference: ..., // optional
};

// Call the `createNotification()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createNotification(createNotificationVars);
// Variables can be defined inline as well.
const { data } = await createNotification({ title: ..., message: ..., scheduledAt: ..., priority: ..., soundPreference: ..., vibrationPreference: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createNotification(dataConnect, createNotificationVars);

console.log(data.notification_insert);

// Or, you can use the `Promise` API.
createNotification(createNotificationVars).then((response) => {
  const data = response.data;
  console.log(data.notification_insert);
});
```

### Using `CreateNotification`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createNotificationRef, CreateNotificationVariables } from '@dataconnect/generated';

// The `CreateNotification` mutation requires an argument of type `CreateNotificationVariables`:
const createNotificationVars: CreateNotificationVariables = {
  title: ..., 
  message: ..., 
  scheduledAt: ..., 
  priority: ..., // optional
  soundPreference: ..., // optional
  vibrationPreference: ..., // optional
};

// Call the `createNotificationRef()` function to get a reference to the mutation.
const ref = createNotificationRef(createNotificationVars);
// Variables can be defined inline as well.
const ref = createNotificationRef({ title: ..., message: ..., scheduledAt: ..., priority: ..., soundPreference: ..., vibrationPreference: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createNotificationRef(dataConnect, createNotificationVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.notification_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.notification_insert);
});
```

## UpdateNotificationStatus
You can execute the `UpdateNotificationStatus` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateNotificationStatus(vars: UpdateNotificationStatusVariables): MutationPromise<UpdateNotificationStatusData, UpdateNotificationStatusVariables>;

interface UpdateNotificationStatusRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateNotificationStatusVariables): MutationRef<UpdateNotificationStatusData, UpdateNotificationStatusVariables>;
}
export const updateNotificationStatusRef: UpdateNotificationStatusRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateNotificationStatus(dc: DataConnect, vars: UpdateNotificationStatusVariables): MutationPromise<UpdateNotificationStatusData, UpdateNotificationStatusVariables>;

interface UpdateNotificationStatusRef {
  ...
  (dc: DataConnect, vars: UpdateNotificationStatusVariables): MutationRef<UpdateNotificationStatusData, UpdateNotificationStatusVariables>;
}
export const updateNotificationStatusRef: UpdateNotificationStatusRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateNotificationStatusRef:
```typescript
const name = updateNotificationStatusRef.operationName;
console.log(name);
```

### Variables
The `UpdateNotificationStatus` mutation requires an argument of type `UpdateNotificationStatusVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateNotificationStatusVariables {
  id: UUIDString;
  notificationStatus: string;
}
```
### Return Type
Recall that executing the `UpdateNotificationStatus` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateNotificationStatusData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateNotificationStatusData {
  notificationHistory_insert: NotificationHistory_Key;
}
```
### Using `UpdateNotificationStatus`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateNotificationStatus, UpdateNotificationStatusVariables } from '@dataconnect/generated';

// The `UpdateNotificationStatus` mutation requires an argument of type `UpdateNotificationStatusVariables`:
const updateNotificationStatusVars: UpdateNotificationStatusVariables = {
  id: ..., 
  notificationStatus: ..., 
};

// Call the `updateNotificationStatus()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateNotificationStatus(updateNotificationStatusVars);
// Variables can be defined inline as well.
const { data } = await updateNotificationStatus({ id: ..., notificationStatus: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateNotificationStatus(dataConnect, updateNotificationStatusVars);

console.log(data.notificationHistory_insert);

// Or, you can use the `Promise` API.
updateNotificationStatus(updateNotificationStatusVars).then((response) => {
  const data = response.data;
  console.log(data.notificationHistory_insert);
});
```

### Using `UpdateNotificationStatus`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateNotificationStatusRef, UpdateNotificationStatusVariables } from '@dataconnect/generated';

// The `UpdateNotificationStatus` mutation requires an argument of type `UpdateNotificationStatusVariables`:
const updateNotificationStatusVars: UpdateNotificationStatusVariables = {
  id: ..., 
  notificationStatus: ..., 
};

// Call the `updateNotificationStatusRef()` function to get a reference to the mutation.
const ref = updateNotificationStatusRef(updateNotificationStatusVars);
// Variables can be defined inline as well.
const ref = updateNotificationStatusRef({ id: ..., notificationStatus: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateNotificationStatusRef(dataConnect, updateNotificationStatusVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.notificationHistory_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.notificationHistory_insert);
});
```

