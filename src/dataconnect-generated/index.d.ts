import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface CreateNotificationData {
  notification_insert: Notification_Key;
}

export interface CreateNotificationVariables {
  title: string;
  message: string;
  scheduledAt: TimestampString;
  priority?: string | null;
  soundPreference?: string | null;
  vibrationPreference?: string | null;
}

export interface GetUserNotificationsData {
  notifications: ({
    id: UUIDString;
    title: string;
    message: string;
    scheduledAt: TimestampString;
    priority?: string | null;
  } & Notification_Key)[];
}

export interface GetUserNotificationsVariables {
  userId: UUIDString;
}

export interface ListAllNotificationsData {
  notifications: ({
    id: UUIDString;
    title: string;
    message: string;
    scheduledAt: TimestampString;
    priority?: string | null;
  } & Notification_Key)[];
}

export interface NotificationHistory_Key {
  id: UUIDString;
  __typename?: 'NotificationHistory_Key';
}

export interface NotificationRecurrence_Key {
  id: UUIDString;
  __typename?: 'NotificationRecurrence_Key';
}

export interface Notification_Key {
  id: UUIDString;
  __typename?: 'Notification_Key';
}

export interface SubscriptionType_Key {
  id: UUIDString;
  __typename?: 'SubscriptionType_Key';
}

export interface UpdateNotificationStatusData {
  notificationHistory_insert: NotificationHistory_Key;
}

export interface UpdateNotificationStatusVariables {
  id: UUIDString;
  notificationStatus: string;
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface ListAllNotificationsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListAllNotificationsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListAllNotificationsData, undefined>;
  operationName: string;
}
export const listAllNotificationsRef: ListAllNotificationsRef;

export function listAllNotifications(): QueryPromise<ListAllNotificationsData, undefined>;
export function listAllNotifications(dc: DataConnect): QueryPromise<ListAllNotificationsData, undefined>;

interface GetUserNotificationsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserNotificationsVariables): QueryRef<GetUserNotificationsData, GetUserNotificationsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserNotificationsVariables): QueryRef<GetUserNotificationsData, GetUserNotificationsVariables>;
  operationName: string;
}
export const getUserNotificationsRef: GetUserNotificationsRef;

export function getUserNotifications(vars: GetUserNotificationsVariables): QueryPromise<GetUserNotificationsData, GetUserNotificationsVariables>;
export function getUserNotifications(dc: DataConnect, vars: GetUserNotificationsVariables): QueryPromise<GetUserNotificationsData, GetUserNotificationsVariables>;

interface CreateNotificationRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateNotificationVariables): MutationRef<CreateNotificationData, CreateNotificationVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateNotificationVariables): MutationRef<CreateNotificationData, CreateNotificationVariables>;
  operationName: string;
}
export const createNotificationRef: CreateNotificationRef;

export function createNotification(vars: CreateNotificationVariables): MutationPromise<CreateNotificationData, CreateNotificationVariables>;
export function createNotification(dc: DataConnect, vars: CreateNotificationVariables): MutationPromise<CreateNotificationData, CreateNotificationVariables>;

interface UpdateNotificationStatusRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateNotificationStatusVariables): MutationRef<UpdateNotificationStatusData, UpdateNotificationStatusVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateNotificationStatusVariables): MutationRef<UpdateNotificationStatusData, UpdateNotificationStatusVariables>;
  operationName: string;
}
export const updateNotificationStatusRef: UpdateNotificationStatusRef;

export function updateNotificationStatus(vars: UpdateNotificationStatusVariables): MutationPromise<UpdateNotificationStatusData, UpdateNotificationStatusVariables>;
export function updateNotificationStatus(dc: DataConnect, vars: UpdateNotificationStatusVariables): MutationPromise<UpdateNotificationStatusData, UpdateNotificationStatusVariables>;

