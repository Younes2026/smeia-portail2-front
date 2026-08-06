import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import type {
  DirectusBrand,
  DirectusCustomer,
  DirectusRelation,
  DirectusRepair,
  DirectusResource,
  DirectusServiceType,
  DirectusStatus,
  DirectusVehicle,
  DirectusWorkshop,
} from '@/features/repairs/model/repair.types';
import { useTechnicianProfile } from '@/features/technician/hooks/useTechnicianProfile';
import {
  useTechnicianRepairMutation,
  useTechnicianRepairs,
} from '@/features/technician/hooks/useTechnicianRepairs';
import { TechnicianPortalLayout } from '@/features/technician/shared/ui/TechnicianPortalLayout';

type FilterValue = 'all' | 'unassigned' | 'mine';
type FormState = {
  note: string;
  real_diagnosis: string;
  solution_description: string;
  technician_recommendations: string;
  work_done: string;
};

const emptyForm: FormState = {
  note: '',
  real_diagnosis: '',
  solution_description: '',
  technician_recommendations: '',
  work_done: '',
};

function isRelationObject<T>(relation: DirectusRelation<T>): relation is T {
  return typeof relation === 'object' && relation !== null;
}

function normalize(value?: string | null): string {
  return value?.trim().toLocaleLowerCase('fr-FR') ?? '';
}

function getWorkshopId(resource: DirectusResource | null | undefined): number | null {
  const workshop = resource?.workshop_id;

  if (typeof workshop === 'number') {
    return workshop;
  }

  return workshop?.id ?? null;
}

function getWorkshopLabel(resource: DirectusResource | null | undefined): string {
  const workshop = resource?.workshop_id ?? null;

  if (typeof workshop === 'number') {
    return `Atelier #${workshop}`;
  }

  if (isRelationObject(workshop)) {
    return (
      workshop.name?.trim() ||
      workshop.label?.trim() ||
      `Atelier #${workshop.id}`
    );
  }

  return 'Atelier #-';
}

function getResourceId(repair: DirectusRepair): number | null {
  const resource = repair.resource_id ?? null;

  if (typeof resource === 'number') {
    return resource;
  }

  return resource?.id ?? null;
}

function getResourceName(repair: DirectusRepair): string {
  const resource = repair.resource_id ?? null;

  if (typeof resource === 'number') {
    return `Technicien #${resource}`;
  }

  return resource?.full_name?.trim() || 'Non affecté';
}

function getRelationName<
  T extends { id: number; label?: string | null; name?: string | null }
>(
  relation: DirectusRelation<T>,
  fallback: string
): string {
  if (!isRelationObject(relation)) {
    return fallback;
  }

  return relation.name?.trim() || relation.label?.trim() || fallback;
}

function getVehicle(repair: DirectusRepair): DirectusVehicle | null {
  const vehicle = repair.vehicle_id ?? null;

  return isRelationObject(vehicle) ? vehicle : null;
}

function getBrand(repair: DirectusRepair): DirectusRelation<DirectusBrand> {
  const brand = repair.brand_id ?? null;

  if (isRelationObject(brand)) {
    return brand;
  }

  return getVehicle(repair)?.brand_id ?? brand;
}

function getCustomer(repair: DirectusRepair): DirectusRelation<DirectusCustomer> {
  const customer = repair.customer_id ?? null;

  if (isRelationObject(customer)) {
    return customer;
  }

  const vehicleCustomer = getVehicle(repair)?.customer_id ?? null;

  return isRelationObject(vehicleCustomer) ? vehicleCustomer : customer ?? vehicleCustomer;
}

function getCustomerName(repair: DirectusRepair): string {
  const customer = getCustomer(repair);

  if (!isRelationObject(customer)) {
    return customer ? `Client #${customer}` : 'Client non renseigné';
  }

  const fullName = `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim();

  return fullName || customer.email || customer.phone || `Client #${customer.id}`;
}

function getVehicleLabel(repair: DirectusRepair): string {
  const vehicle = getVehicle(repair);

  if (!vehicle) {
    return typeof repair.vehicle_id === 'number'
      ? `Véhicule #${repair.vehicle_id}`
      : 'Véhicule non renseigné';
  }

  const brandName = getRelationName(getBrand(repair), '');
  const vehicleRecord = vehicle as unknown as Record<string, unknown>;
  const model =
    vehicle.model?.trim() ||
    (typeof vehicleRecord.label === 'string' ? vehicleRecord.label.trim() : '') ||
    (typeof vehicleRecord.name === 'string' ? vehicleRecord.name.trim() : '');
  const registration =
    vehicle.registration_number?.trim() ||
    (typeof vehicleRecord.license_plate === 'string'
      ? vehicleRecord.license_plate.trim()
      : '') ||
    (typeof vehicleRecord.immatriculation === 'string'
      ? vehicleRecord.immatriculation.trim()
      : '');

  return [brandName, model, registration]
    .filter((value): value is string => Boolean(value))
    .join(' · ') || `Véhicule #${vehicle.id}`;
}

function getStatusName(repair: DirectusRepair): string {
  return getRelationName<DirectusStatus>(
    repair.status_id ?? null,
    typeof repair.status_id === 'number' ? `Statut #${repair.status_id}` : 'Statut non renseigné'
  );
}

function getServiceTypeName(repair: DirectusRepair): string {
  return getRelationName<DirectusServiceType>(
    repair.service_type_id ?? null,
    typeof repair.service_type_id === 'number'
      ? `Service #${repair.service_type_id}`
      : 'Service non renseigné'
  );
}

function getWorkshopName(repair: DirectusRepair): string {
  return getRelationName<DirectusWorkshop>(
    repair.workshop_id ?? null,
    typeof repair.workshop_id === 'number'
      ? `Atelier #${repair.workshop_id}`
      : 'Atelier non renseigné'
  );
}

function getRepairDate(repair: DirectusRepair): string | null {
  return repair.entry_date ?? repair.appointment_date ?? repair.start_date ?? repair.date_created ?? null;
}

function formatDate(value?: string | null): string {
  if (!value) {
    return 'Date non renseignée';
  }

  const normalizedValue = value.includes('T') ? value : `${value}T12:00:00`;
  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function isCompletedRepair(repair: DirectusRepair): boolean {
  if (repair.real_exit_date) {
    return true;
  }

  const status = normalize(getStatusName(repair));

  return ['completed', 'complete', 'terminé', 'termine', 'clôturé', 'cloture'].some(
    (value) => status.includes(value)
  );
}

function getTechnicianName(resource: DirectusResource | null | undefined): string {
  return resource?.full_name?.trim() || 'Technicien';
}

function getAssignmentLabel(
  repair: DirectusRepair,
  technician: DirectusResource
): string {
  const repairResourceId = getResourceId(repair);

  if (repairResourceId === null) {
    return 'Non affecté';
  }

  if (repairResourceId === technician.id) {
    return getTechnicianName(technician);
  }

  const repairResource = repair.resource_id ?? null;

  if (isRelationObject(repairResource)) {
    return repairResource.full_name?.trim() || 'Affecté';
  }

  return 'Affecté';
}

function getAssignmentBadgeLabel(
  repair: DirectusRepair,
  technician: DirectusResource
): string {
  const repairResourceId = getResourceId(repair);

  if (repairResourceId === null) {
    return 'Non affecté';
  }

  return repairResourceId === technician.id ? 'Mes dossiers' : 'Affecté';
}

function getProgressBadgeLabel(repair: DirectusRepair): string {
  return isCompletedRepair(repair) ? 'Terminé' : 'En cours';
}

function getFormState(repair: DirectusRepair | null): FormState {
  if (!repair) {
    return emptyForm;
  }

  return {
    note: repair.note ?? '',
    real_diagnosis: repair.real_diagnosis ?? '',
    solution_description: repair.solution_description ?? '',
    technician_recommendations: repair.technician_recommendations ?? '',
    work_done: repair.work_done ?? '',
  };
}

function matchesSearch(repair: DirectusRepair, searchQuery: string): boolean {
  const query = normalize(searchQuery);

  if (!query) {
    return true;
  }

  return [
    String(repair.id),
    repair.document_number ?? '',
    getVehicleLabel(repair),
    getServiceTypeName(repair),
    getStatusName(repair),
    getResourceName(repair),
  ].some((value) => normalize(value).includes(query));
}

export function TechnicianRepairsScreen() {
  const { width } = useWindowDimensions();
  const isNarrow = width < 920;
  const profileQuery = useTechnicianProfile();
  const resource = profileQuery.data ?? null;
  const workshopId = getWorkshopId(resource);
  const workshopLabel = getWorkshopLabel(resource);
  const repairsQuery = useTechnicianRepairs(workshopId);
  const repairMutation = useTechnicianRepairMutation(workshopId);
  const repairs = repairsQuery.data ?? [];
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterValue>('all');
  const [selectedRepairId, setSelectedRepairId] = useState<number | null>(null);
  const [formState, setFormState] = useState<FormState>(emptyForm);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const filteredRepairs = useMemo(
    () =>
      repairs.filter((repair) => {
        const repairResourceId = getResourceId(repair);
        const matchesFilter =
          filter === 'all' ||
          (filter === 'unassigned' && repairResourceId === null) ||
          (filter === 'mine' && repairResourceId === resource?.id);

        return matchesFilter && matchesSearch(repair, searchQuery);
      }),
    [filter, repairs, resource?.id, searchQuery]
  );
  const selectedRepair = useMemo(
    () =>
      repairs.find((repair) => repair.id === selectedRepairId) ??
      filteredRepairs[0] ??
      null,
    [filteredRepairs, repairs, selectedRepairId]
  );
  const selectedResourceId = selectedRepair ? getResourceId(selectedRepair) : null;
  const canEdit = Boolean(
    selectedRepair && resource && (selectedResourceId === null || selectedResourceId === resource.id)
  );
  const isAssignedToOther = Boolean(
    selectedRepair && selectedResourceId !== null && selectedResourceId !== resource?.id
  );

  useEffect(() => {
    setFormState(getFormState(selectedRepair));
    setSaveMessage(null);
  }, [selectedRepair?.id]);

  const handleClaim = () => {
    if (!selectedRepair || !resource) {
      return;
    }

    repairMutation.mutate(
      {
        repairId: selectedRepair.id,
        patch: { resource_id: resource.id },
      },
      {
        onSuccess: () => {
          setSaveMessage('Dossier pris en charge.');
        },
      }
    );
  };

  const handleSave = () => {
    if (!selectedRepair || !resource || !canEdit) {
      return;
    }

    repairMutation.mutate(
      {
        repairId: selectedRepair.id,
        patch: {
          note: formState.note,
          real_diagnosis: formState.real_diagnosis,
          resource_id: selectedResourceId ?? resource.id,
          solution_description: formState.solution_description,
          technician_recommendations: formState.technician_recommendations,
          work_done: formState.work_done,
        },
      },
      {
        onSuccess: () => {
          setSaveMessage('Dossier enregistré.');
        },
      }
    );
  };

  if (profileQuery.isLoading) {
    return (
      <TechnicianPortalLayout activeRoute="/technician/repairs">
        <View style={styles.stateContainer}>
          <LoadingState message="Chargement du profil technicien..." />
        </View>
      </TechnicianPortalLayout>
    );
  }

  if (profileQuery.isError) {
    return (
      <TechnicianPortalLayout activeRoute="/technician/repairs">
        <View style={styles.stateContainer}>
          <ErrorState
            title="Erreur de chargement"
            message="Impossible de charger votre profil technicien."
            onRetry={() => {
              profileQuery.refetch();
            }}
          />
        </View>
      </TechnicianPortalLayout>
    );
  }

  if (!resource) {
    return (
      <TechnicianPortalLayout activeRoute="/technician/repairs">
        <View style={styles.stateContainer}>
          <EmptyState
            title="Profil technicien introuvable"
            message="Aucun profil technicien actif n’est lié à ce compte."
          />
        </View>
      </TechnicianPortalLayout>
    );
  }

  return (
    <TechnicianPortalLayout activeRoute="/technician/repairs">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{workshopLabel}</Text>
          <Text style={styles.title}>Dossiers réparation</Text>
          <Text style={styles.subtitle}>
            Suivi atelier, prise en charge et notes techniques pour vos dossiers.
          </Text>
        </View>

        {repairsQuery.isLoading ? (
          <View style={styles.statePanel}>
            <LoadingState message="Chargement des dossiers réparation..." />
          </View>
        ) : null}

        {repairsQuery.isError ? (
          <View style={styles.statePanel}>
            <ErrorState
              title="Erreur de chargement"
              message="Impossible de charger les dossiers réparation de votre atelier."
              onRetry={() => {
                repairsQuery.refetch();
              }}
            />
          </View>
        ) : null}

        {!repairsQuery.isLoading && !repairsQuery.isError && repairs.length === 0 ? (
          <View style={styles.statePanel}>
            <EmptyState
              title="Aucun dossier atelier"
              message="Aucun dossier réparation pour votre atelier."
            />
          </View>
        ) : null}

        {repairs.length > 0 ? (
          <>
            <View style={styles.filterPanel}>
              <TextInput
                onChangeText={setSearchQuery}
                placeholder="Rechercher par dossier, véhicule, service ou statut"
                placeholderTextColor="#8A97A8"
                style={styles.searchInput}
                value={searchQuery}
              />
              <View style={styles.filterButtons}>
                <FilterButton active={filter === 'all'} label="Tous atelier" onPress={() => setFilter('all')} />
                <FilterButton active={filter === 'unassigned'} label="Non affectés" onPress={() => setFilter('unassigned')} />
                <FilterButton active={filter === 'mine'} label="Mes dossiers" onPress={() => setFilter('mine')} />
              </View>
            </View>

            <View style={[styles.workspaceGrid, isNarrow && styles.stack]}>
              <View style={styles.listPanel}>
                <View style={styles.panelHeader}>
                  <Text style={styles.panelTitle}>File d’attente atelier</Text>
                  <Text style={styles.panelMeta}>{filteredRepairs.length} résultat(s)</Text>
                </View>

                {filteredRepairs.length > 0 ? (
                  <View style={styles.repairList}>
                    {filteredRepairs.map((repair) => (
                      <RepairCard
                        key={repair.id}
                        active={repair.id === selectedRepair?.id}
                        onPress={() => setSelectedRepairId(repair.id)}
                        repair={repair}
                        technician={resource}
                      />
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyFilterPanel}>
                    <Text style={styles.emptyFilterText}>Aucun dossier ne correspond aux filtres.</Text>
                  </View>
                )}
              </View>

              <View style={styles.detailPanel}>
                {selectedRepair ? (
                  <RepairInterventionDetail
                    canEdit={canEdit}
                    formState={formState}
                    isAssignedToOther={isAssignedToOther}
                    isPending={repairMutation.isPending}
                    mutationError={repairMutation.error}
                    onChange={setFormState}
                    onClaim={handleClaim}
                    onSave={handleSave}
                    repair={selectedRepair}
                    saveMessage={saveMessage}
                    selectedResourceId={selectedResourceId}
                    technician={resource}
                  />
                ) : (
                  <View style={styles.emptyFilterPanel}>
                    <Text style={styles.emptyFilterText}>
                      Sélectionnez un dossier pour afficher le détail.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </TechnicianPortalLayout>
  );
}

type FilterButtonProps = {
  active: boolean;
  label: string;
  onPress: () => void;
};

function FilterButton({ active, label, onPress }: FilterButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.filterButton,
        active && styles.filterButtonActive,
        hovered && !active && styles.filterButtonHovered,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.filterButtonText, active && styles.filterButtonTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

type RepairCardProps = {
  active: boolean;
  onPress: () => void;
  repair: DirectusRepair;
  technician: DirectusResource;
};

function RepairCard({ active, onPress, repair, technician }: RepairCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.repairCard,
        active && styles.repairCardActive,
        hovered && !active && styles.repairCardHovered,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.documentNumber}>Dossier #{repair.id}</Text>
          <Text numberOfLines={1} style={styles.cardService}>
            {getServiceTypeName(repair)}
          </Text>
        </View>
        <StatusBadge repair={repair} />
      </View>

      <Text numberOfLines={1} style={styles.cardVehicle}>
        {getVehicleLabel(repair)}
      </Text>

      <View style={styles.cardMetaRow}>
        <Text style={styles.cardMetaText}>{formatDate(getRepairDate(repair))}</Text>
        <Text numberOfLines={1} style={styles.cardMetaText}>
          {getAssignmentLabel(repair, technician)}
        </Text>
      </View>

      <View style={styles.badgeRow}>
        <AssignmentBadge repair={repair} technician={technician} />
        <ProgressBadge repair={repair} />
      </View>
    </Pressable>
  );
}

type StatusBadgeProps = {
  repair: DirectusRepair;
};

function StatusBadge({ repair }: StatusBadgeProps) {
  return (
    <Text
      style={[
        styles.statusBadge,
        isCompletedRepair(repair) && styles.statusBadgeDone,
      ]}
    >
      {getStatusName(repair)}
    </Text>
  );
}

type AssignmentBadgeProps = {
  repair: DirectusRepair;
  technician: DirectusResource;
};

function AssignmentBadge({ repair, technician }: AssignmentBadgeProps) {
  const repairResourceId = getResourceId(repair);
  const isMine = repairResourceId === technician.id;
  const isUnassigned = repairResourceId === null;

  if (!isMine && !isUnassigned) {
    return null;
  }

  return (
    <Text
      style={[
        styles.assignmentBadge,
        isUnassigned && styles.assignmentBadgeOpen,
        isMine && styles.assignmentBadgeMine,
      ]}
    >
      {getAssignmentBadgeLabel(repair, technician)}
    </Text>
  );
}

function ProgressBadge({ repair }: StatusBadgeProps) {
  const completed = isCompletedRepair(repair);

  return (
    <Text
      style={[
        styles.progressBadge,
        completed && styles.progressBadgeDone,
      ]}
    >
      {getProgressBadgeLabel(repair)}
    </Text>
  );
}

type RepairDetailProps = {
  canEdit: boolean;
  formState: FormState;
  isAssignedToOther: boolean;
  isPending: boolean;
  mutationError: Error | null;
  onChange: (state: FormState) => void;
  onClaim: () => void;
  onSave: () => void;
  repair: DirectusRepair;
  saveMessage: string | null;
  selectedResourceId: number | null;
  technician: DirectusResource;
  technicianId?: number;
};

function RepairDetail({
  canEdit,
  formState,
  isAssignedToOther,
  isPending,
  mutationError,
  onChange,
  onClaim,
  onSave,
  repair,
  saveMessage,
  selectedResourceId,
  technician,
  technicianId,
}: RepairDetailProps) {
  return (
    <View style={styles.detailContent}>
      <View style={styles.detailHeader}>
        <View style={styles.detailHeaderCopy}>
          <Text style={styles.detailKicker}>Dossier #{repair.id}</Text>
          <Text style={styles.detailTitle}>{getVehicleLabel(repair)}</Text>
          <Text style={styles.detailSubtitle}>{getServiceTypeName(repair)}</Text>
        </View>
        <Text style={styles.statusBadge}>{getStatusName(repair)}</Text>
      </View>

      <View style={styles.infoGrid}>
        <InfoTile label="Client" value={getCustomerName(repair)} />
        <InfoTile label="Véhicule" value={getVehicleLabel(repair)} />
        <InfoTile label="Service demandé" value={getServiceTypeName(repair)} />
        <InfoTile label="Atelier" value={getWorkshopName(repair)} />
        <InfoTile label="Statut" value={getStatusName(repair)} />
        <InfoTile label="Date entrée" value={formatDate(getRepairDate(repair))} />
      </View>

      <ReadOnlyBlock label="Description" value={repair.description} />
      <ReadOnlyBlock label="Note existante" value={repair.note} />

      <View style={styles.technicalPanel}>
        <Text style={styles.sectionTitle}>Infos technicien</Text>
        <InfoLine label="Resource dossier" value={selectedResourceId ? String(selectedResourceId) : 'Non affecté'} />
        <InfoLine label="Votre resource_id" value={String(technicianId)} />

        {selectedResourceId === null ? (
          <Pressable
            accessibilityRole="button"
            disabled={isPending}
            onPress={onClaim}
            style={({ hovered, pressed }) => [
              styles.secondaryButton,
              hovered && !isPending && styles.secondaryButtonHovered,
              pressed && !isPending && styles.pressed,
              isPending && styles.disabled,
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              {isPending ? 'En cours...' : 'Prendre en charge'}
            </Text>
          </Pressable>
        ) : null}

        {isAssignedToOther ? (
          <View style={styles.lockNotice}>
            <Text style={styles.lockNoticeText}>
              Dossier affecté à un autre technicien. Consultation uniquement.
            </Text>
          </View>
        ) : null}

        <TextArea
          editable={canEdit && !isPending}
          label="Diagnostic réel"
          onChangeText={(value) => onChange({ ...formState, real_diagnosis: value })}
          value={formState.real_diagnosis}
        />
        <TextArea
          editable={canEdit && !isPending}
          label="Travaux effectués"
          onChangeText={(value) => onChange({ ...formState, work_done: value })}
          value={formState.work_done}
        />
        <TextArea
          editable={canEdit && !isPending}
          label="Solution"
          onChangeText={(value) => onChange({ ...formState, solution_description: value })}
          value={formState.solution_description}
        />
        <TextArea
          editable={canEdit && !isPending}
          label="Recommandations technicien"
          onChangeText={(value) => onChange({ ...formState, technician_recommendations: value })}
          value={formState.technician_recommendations}
        />
        <TextArea
          editable={canEdit && !isPending}
          label="Note"
          onChangeText={(value) => onChange({ ...formState, note: value })}
          value={formState.note}
        />

        {mutationError ? (
          <Text style={styles.errorText}>Enregistrement impossible pour le moment.</Text>
        ) : null}
        {saveMessage ? <Text style={styles.successText}>{saveMessage}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={!canEdit || isPending}
          onPress={onSave}
          style={({ hovered, pressed }) => [
            styles.primaryButton,
            hovered && canEdit && !isPending && styles.primaryButtonHovered,
            pressed && canEdit && !isPending && styles.pressed,
            (!canEdit || isPending) && styles.disabled,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {isPending ? 'Enregistrement...' : 'Enregistrer'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function RepairInterventionDetail({
  canEdit,
  formState,
  isAssignedToOther,
  isPending,
  mutationError,
  onChange,
  onClaim,
  onSave,
  repair,
  saveMessage,
  selectedResourceId,
  technician,
}: RepairDetailProps) {
  return (
    <View style={styles.detailContent}>
      <View style={styles.detailHeader}>
        <View style={styles.detailHeaderCopy}>
          <Text style={styles.detailKicker}>Fiche intervention</Text>
          <Text style={styles.detailTitle}>Dossier #{repair.id}</Text>
          <Text style={styles.detailSubtitle}>{getVehicleLabel(repair)}</Text>
        </View>
        <StatusBadge repair={repair} />
      </View>

      <DetailBlock title="Résumé dossier">
        <View style={styles.infoGrid}>
          <InfoTile label="Véhicule" value={getVehicleLabel(repair)} />
          <InfoTile label="Service demandé" value={getServiceTypeName(repair)} />
          <InfoTile label="Statut" value={getStatusName(repair)} />
          <InfoTile label="Atelier" value={getWorkshopName(repair)} />
        </View>
      </DetailBlock>

      <DetailBlock title="Informations réception">
        <View style={styles.infoGrid}>
          <InfoTile label="Client" value={getCustomerName(repair)} />
          <InfoTile label="Date entrée" value={formatDate(getRepairDate(repair))} />
        </View>
        <ReadOnlyBlock label="Description" value={repair.description} />
        <ReadOnlyBlock label="Note existante" value={repair.note} />
      </DetailBlock>

      <DetailBlock title="Prise en charge">
        <View style={styles.infoGrid}>
          <InfoTile
            label="Technicien affecté"
            value={getAssignmentLabel(repair, technician)}
          />
          <InfoTile
            label="Technicien connecté"
            value={getTechnicianName(technician)}
          />
        </View>

        {selectedResourceId === null ? (
          <Pressable
            accessibilityRole="button"
            disabled={isPending}
            onPress={onClaim}
            style={({ hovered, pressed }) => [
              styles.secondaryButton,
              hovered && !isPending && styles.secondaryButtonHovered,
              pressed && !isPending && styles.pressed,
              isPending && styles.disabled,
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              {isPending ? 'En cours...' : 'Prendre en charge'}
            </Text>
          </Pressable>
        ) : null}

        {isAssignedToOther ? (
          <View style={styles.lockNotice}>
            <Text style={styles.lockNoticeText}>
              Dossier affecté à un autre technicien. Consultation uniquement.
            </Text>
          </View>
        ) : null}
      </DetailBlock>

      <DetailBlock title="Intervention technicien">
        <TextArea
          editable={canEdit && !isPending}
          label="Diagnostic réel"
          onChangeText={(value) => onChange({ ...formState, real_diagnosis: value })}
          value={formState.real_diagnosis}
        />
        <TextArea
          editable={canEdit && !isPending}
          label="Travaux effectués"
          onChangeText={(value) => onChange({ ...formState, work_done: value })}
          value={formState.work_done}
        />
        <TextArea
          editable={canEdit && !isPending}
          label="Solution"
          onChangeText={(value) => onChange({ ...formState, solution_description: value })}
          value={formState.solution_description}
        />
        <TextArea
          editable={canEdit && !isPending}
          label="Recommandations technicien"
          onChangeText={(value) =>
            onChange({ ...formState, technician_recommendations: value })
          }
          value={formState.technician_recommendations}
        />
        <TextArea
          editable={canEdit && !isPending}
          label="Note"
          onChangeText={(value) => onChange({ ...formState, note: value })}
          value={formState.note}
        />

        {mutationError ? (
          <Text style={styles.errorText}>Enregistrement impossible pour le moment.</Text>
        ) : null}
        {saveMessage ? <Text style={styles.successText}>{saveMessage}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={!canEdit || isPending}
          onPress={onSave}
          style={({ hovered, pressed }) => [
            styles.primaryButton,
            hovered && canEdit && !isPending && styles.primaryButtonHovered,
            pressed && canEdit && !isPending && styles.pressed,
            (!canEdit || isPending) && styles.disabled,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {isPending ? 'Enregistrement...' : 'Enregistrer'}
          </Text>
        </Pressable>
      </DetailBlock>
    </View>
  );
}

type DetailBlockProps = {
  children: ReactNode;
  title: string;
};

function DetailBlock({ children, title }: DetailBlockProps) {
  return (
    <View style={styles.detailBlock}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

type InfoLineProps = {
  label: string;
  value: string;
};

function InfoLine({ label, value }: InfoLineProps) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLineLabel}>{label}</Text>
      <Text style={styles.infoLineValue}>{value}</Text>
    </View>
  );
}

type InfoTileProps = InfoLineProps;

function InfoTile({ label, value }: InfoTileProps) {
  return (
    <View style={styles.infoTile}>
      <Text style={styles.infoTileLabel}>{label}</Text>
      <Text style={styles.infoTileValue}>{value}</Text>
    </View>
  );
}

type ReadOnlyBlockProps = {
  label: string;
  value?: string | null;
};

function ReadOnlyBlock({ label, value }: ReadOnlyBlockProps) {
  return (
    <View style={styles.readOnlyBlock}>
      <Text style={styles.readOnlyLabel}>{label}</Text>
      <Text style={styles.readOnlyText}>{value?.trim() || 'Non renseigné'}</Text>
    </View>
  );
}

type TextAreaProps = {
  editable: boolean;
  label: string;
  onChangeText: (value: string) => void;
  value: string;
};

function TextArea({ editable, label, onChangeText, value }: TextAreaProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        editable={editable}
        multiline
        onChangeText={onChangeText}
        placeholder="Non renseigné"
        placeholderTextColor="#8A97A8"
        style={[styles.textArea, !editable && styles.textAreaDisabled]}
        textAlignVertical="top"
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 1320,
    alignSelf: 'center',
    gap: spacing.lg,
    padding: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  header: {
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    gap: spacing.xs,
  },
  eyebrow: {
    color: '#2F5FA6',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  title: {
    color: '#15294D',
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
  },
  subtitle: {
    color: '#5A6470',
    fontSize: typography.fontSize.md,
  },
  statePanel: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  filterPanel: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
  },
  searchInput: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#D5DFEC',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    color: '#15294D',
    fontSize: typography.fontSize.md,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterButton: {
    minHeight: 38,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#D8E3F1',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  filterButtonActive: {
    borderColor: '#2F5FA6',
    backgroundColor: '#2F5FA6',
  },
  filterButtonHovered: {
    borderColor: '#B8C9DF',
    backgroundColor: '#F7FAFF',
  },
  filterButtonText: {
    color: '#15294D',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  workspaceGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  stack: {
    flexDirection: 'column',
  },
  listPanel: {
    flex: 0.86,
    minWidth: 0,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
  },
  detailPanel: {
    flex: 1.14,
    minWidth: 320,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  panelTitle: {
    color: '#15294D',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  panelMeta: {
    color: '#5A6470',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  repairList: {
    gap: spacing.sm,
  },
  repairCard: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  repairCardActive: {
    borderColor: '#2F5FA6',
    backgroundColor: '#F1F6FD',
  },
  repairCardHovered: {
    borderColor: '#B8C9DF',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  documentNumber: {
    color: '#2F5FA6',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  cardService: {
    color: '#15294D',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  cardVehicle: {
    color: '#5A6470',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  cardMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardMetaText: {
    color: '#5A6470',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: '#B9D0EB',
    borderRadius: 999,
    backgroundColor: '#EDF5FD',
    color: '#2F5FA6',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  statusBadgeDone: {
    borderColor: '#B7D5C0',
    backgroundColor: '#F0F9F3',
    color: '#166534',
  },
  assignmentBadge: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: '#D8E2F0',
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    color: '#5A6470',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  assignmentBadgeOpen: {
    borderColor: '#EBCB8C',
    backgroundColor: '#FFF9EC',
    color: '#9A5B13',
  },
  assignmentBadgeMine: {
    borderColor: '#B9D0EB',
    backgroundColor: '#EDF5FD',
    color: '#2F5FA6',
  },
  progressBadge: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: '#D8E2F0',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    color: '#5A6470',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  progressBadgeDone: {
    borderColor: '#B7D5C0',
    backgroundColor: '#F0F9F3',
    color: '#166534',
  },
  infoLine: {
    gap: 2,
  },
  infoLineLabel: {
    color: '#7A8798',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  infoLineValue: {
    color: '#15294D',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  detailContent: {
    gap: spacing.md,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  detailHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  detailKicker: {
    color: '#2F5FA6',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  detailTitle: {
    color: '#15294D',
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  detailSubtitle: {
    color: '#5A6470',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semiBold,
  },
  detailBlock: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  infoTile: {
    flexGrow: 1,
    flexBasis: 180,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    gap: spacing.xs,
  },
  infoTileLabel: {
    color: '#5A6470',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
  },
  infoTileValue: {
    color: '#15294D',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  readOnlyBlock: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E6EAF2',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    gap: spacing.xs,
  },
  readOnlyLabel: {
    color: '#15294D',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  readOnlyText: {
    color: '#5A6470',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  technicalPanel: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#D8E2F0',
    borderRadius: 18,
    backgroundColor: '#FBFCFE',
    gap: spacing.md,
  },
  sectionTitle: {
    color: '#15294D',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    color: '#15294D',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  textArea: {
    minHeight: 86,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#D5DFEC',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    color: '#15294D',
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  textAreaDisabled: {
    backgroundColor: '#F1F4F8',
    color: '#5A6470',
  },
  lockNotice: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#EBCB8C',
    borderRadius: 14,
    backgroundColor: '#FFF9EC',
  },
  lockNoticeText: {
    color: '#6B4B16',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  primaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 14,
    backgroundColor: '#2F5FA6',
  },
  primaryButtonHovered: {
    backgroundColor: '#244F8F',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  secondaryButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#B9D0EB',
    borderRadius: 14,
    backgroundColor: '#EDF5FD',
  },
  secondaryButtonHovered: {
    borderColor: '#2F5FA6',
  },
  secondaryButtonText: {
    color: '#2F5FA6',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  successText: {
    color: '#166534',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  errorText: {
    color: '#B42318',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  emptyFilterPanel: {
    minHeight: 128,
    justifyContent: 'center',
    padding: spacing.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  emptyFilterText: {
    color: '#5A6470',
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.86,
  },
  disabled: {
    opacity: 0.5,
  },
});
