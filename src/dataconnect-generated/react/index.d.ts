import { ListAllNotificationsData, GetUserNotificationsData, GetUserNotificationsVariables, CreateNotificationData, CreateNotificationVariables, UpdateNotificationStatusData, UpdateNotificationStatusVariables } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useListAllNotifications(options?: useDataConnectQueryOptions<ListAllNotificationsData>): UseDataConnectQueryResult<ListAllNotificationsData, undefined>;
export function useListAllNotifications(dc: DataConnect, options?: useDataConnectQueryOptions<ListAllNotificationsData>): UseDataConnectQueryResult<ListAllNotificationsData, undefined>;

export function useGetUserNotifications(vars: GetUserNotificationsVariables, options?: useDataConnectQueryOptions<GetUserNotificationsData>): UseDataConnectQueryResult<GetUserNotificationsData, GetUserNotificationsVariables>;
export function useGetUserNotifications(dc: DataConnect, vars: GetUserNotificationsVariables, options?: useDataConnectQueryOptions<GetUserNotificationsData>): UseDataConnectQueryResult<GetUserNotificationsData, GetUserNotificationsVariables>;

export function useCreateNotification(options?: useDataConnectMutationOptions<CreateNotificationData, FirebaseError, CreateNotificationVariables>): UseDataConnectMutationResult<CreateNotificationData, CreateNotificationVariables>;
export function useCreateNotification(dc: DataConnect, options?: useDataConnectMutationOptions<CreateNotificationData, FirebaseError, CreateNotificationVariables>): UseDataConnectMutationResult<CreateNotificationData, CreateNotificationVariables>;

export function useUpdateNotificationStatus(options?: useDataConnectMutationOptions<UpdateNotificationStatusData, FirebaseError, UpdateNotificationStatusVariables>): UseDataConnectMutationResult<UpdateNotificationStatusData, UpdateNotificationStatusVariables>;
export function useUpdateNotificationStatus(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateNotificationStatusData, FirebaseError, UpdateNotificationStatusVariables>): UseDataConnectMutationResult<UpdateNotificationStatusData, UpdateNotificationStatusVariables>;
