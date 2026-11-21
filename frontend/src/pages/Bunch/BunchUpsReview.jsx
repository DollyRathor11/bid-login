import { useLocation, useNavigate, useParams } from "react-router-dom";
import { UpsReview } from "./BunchBids";

export default function BunchUpsReview() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  return <UpsReview bidId={id} role="analyser" embedded
    onNext={bid => navigate(`/analyser-dashboard/bunch/ups/${id}/documents`, { state: { ...location.state, bidData: bid } })}
    onClose={() => navigate(location.state?.bunchReview?.returnTo || "/analyser-dashboard/bunch")}
    onSaved={() => location.state?.bunchReview
      ? navigate(location.pathname, { replace: true, state: { ...location.state, bunchReview: { ...location.state.bunchReview, submitted: true } } })
      : navigate("/analyser-dashboard/bunch")} />;
}
