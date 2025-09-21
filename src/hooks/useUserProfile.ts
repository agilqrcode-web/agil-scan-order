import { useAuth, useUser } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';

export function useUserProfile() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth(); // Hook para obter o token

  const { data: profileData, isLoading: loading, refetch } = useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: async () => {
      console.log('useUserProfile: QueryFn started.');
      if (!isLoaded || !isSignedIn || !user) {
        console.log('useUserProfile: Clerk not loaded, not signed in, or no user. Returning null.');
        return null;
      }

      console.log(`useUserProfile: Fetching profile for Clerk user ID: ${user.id}`);
      try {
        const token = await getToken({ template: 'agilqrcode' }); // Use o template correto
        if (!token) {
          throw new Error('Failed to get authentication token.');
        }

        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/profile?action=check-profile`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          // O corpo não é mais necessário, o ID do usuário é extraído do token no backend
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('useUserProfile: Error from check-profile API:', errorData);
          throw new Error(errorData.error || 'Failed to check profile via backend.');
        }

        const data = await response.json();
        console.log('useUserProfile: check-profile API response:', data);
        // A API retorna { profileComplete: boolean }
        return data.profileComplete ? { id: user.id, complete: true } : null;

      } catch (error) {
        console.error('useUserProfile: Error fetching profile from backend:', error);
        throw error;
      }
    },
    enabled: isLoaded && isSignedIn && !!user,
    staleTime: 1000 * 60 * 5, // Data is considered fresh for 5 minutes
    gcTime: 1000 * 60 * 10,   // Data is kept in cache for 10 minutes after becoming inactive
    retry: false,
  });

  const profileComplete = !!profileData;
  console.log(`useUserProfile: Profile complete status: ${profileComplete}, Loading: ${loading}`);

  return { profileComplete, loading, refetch };
}
