import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { resolveBunchNavigation } from "../utils/bunchNavigation";

export default function useBunchNavigate() {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback((to, options) => {
    const target = resolveBunchNavigation(location.pathname, location.state?.bunchReview, to, options);
    return navigate(target.to, target.options);
  }, [navigate, location.pathname, location.state]);
}
