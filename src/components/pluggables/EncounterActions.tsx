import { ReferViaNetworkLink } from "@/components/pluggables/ReferViaNetworkLink";

/** `EncounterActions` slot: refer the encounter's patient over the network. */
export default function EncounterActions({
  encounter,
  className,
}: {
  encounter: { id: string; facility: { id: string }; patient: { id: string } };
  className?: string;
}) {
  return (
    <ReferViaNetworkLink
      facilityId={encounter.facility.id}
      patientId={encounter.patient.id}
      encounterId={encounter.id}
      className={className}
    />
  );
}
