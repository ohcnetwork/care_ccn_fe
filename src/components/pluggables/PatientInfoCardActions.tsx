import { ReferViaNetworkLink } from "@/components/pluggables/ReferViaNetworkLink";

/** `PatientInfoCardActions` slot: refer the patient over the network. */
export default function PatientInfoCardActions({
  facilityId,
  patient,
  className,
}: {
  facilityId: string;
  patient: { id: string };
  className?: string;
}) {
  if (!facilityId) return null;
  return (
    <div className={className}>
      <ReferViaNetworkLink facilityId={facilityId} patientId={patient.id} />
    </div>
  );
}
