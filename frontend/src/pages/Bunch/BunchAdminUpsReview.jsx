import { useLocation, useNavigate, useParams } from "react-router-dom";
import { UpsReview } from "./BunchBids";

export default function BunchAdminUpsReview() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const back = () => navigate(location.state?.bunchReview?.returnTo || "/admin-dashboard/bunch-bid-approval");
  return <UpsReview bidId={id} role="admin" embedded onClose={back} onSaved={back} />;
}
