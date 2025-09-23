import { useQuery as apolloUseQuery, useMutation as apolloUseMutation, useSubscription as apolloUseSubscription } from '@apollo/client/react';

// Re-export the hooks with proper typing
export const useQuery = apolloUseQuery;
export const useMutation = apolloUseMutation;
export const useSubscription = apolloUseSubscription;
