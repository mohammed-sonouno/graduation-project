import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCommunities, requestJoinCommunity, dismissCommunityRequest } from '../lib/api';

const LIMIT = 12;

export function useCommunities() {
  const { user, loading: authLoading } = useAuth();
  const [communities, setCommunities] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError]             = useState('');
  const [filters, setFilters]         = useState({ search: '', college: '' });
  const [page, setPage]               = useState(1);
  const [hasMore, setHasMore]         = useState(true);

  const loading = authLoading || fetching;

  const fetch = useCallback(async (currentFilters, currentPage) => {
    setFetching(true);
    setError('');
    try {
      const commParams = {
        page:    currentPage,
        limit:   LIMIT,
        kind:    'community',
        ...(user && currentPage === 1 && { includeMyRequestCards: '1' }),
        ...(currentFilters.college && { college: currentFilters.college }),
        ...(currentFilters.search  && { search:  currentFilters.search  }),
      };
      const data = await getCommunities(commParams);
      const dataList = Array.isArray(data) ? data : [];
      setCommunities((prev) => (currentPage === 1 ? dataList : [...prev, ...dataList]));
      const nComm = dataList.filter((c) => !c.is_community_request).length;
      setHasMore(nComm === LIMIT);
    } catch (err) {
      setError(err.message || 'حدث خطأ، حاول مجدداً');
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    setPage(1);
    setCommunities([]);
    fetch(filters, 1);
  }, [filters, fetch, authLoading]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetch(filters, next);
  };

  const updateFilter = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const refresh = useCallback(() => {
    setPage(1);
    setCommunities([]);
    fetch(filters, 1);
  }, [filters, fetch]);

  const requestJoin = async (id) => {
    await requestJoinCommunity(id);
    const nid = Number(id);
    setCommunities((prev) =>
      prev.map((c) => (Number(c.id) === nid ? { ...c, membership_status: 'pending' } : c))
    );
  };

  const dismissRequest = useCallback(async (requestId) => {
    await dismissCommunityRequest(requestId);
    setCommunities((prev) =>
      prev.filter((c) => !c.is_community_request || c.request_id !== requestId)
    );
  }, []);

  return {
    communities,
    loading,
    error,
    filters,
    hasMore,
    updateFilter,
    loadMore,
    requestJoin,
    refresh,
    dismissRequest,
  };
}
