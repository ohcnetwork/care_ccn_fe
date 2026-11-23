import { useQuery } from "@tanstack/react-query";
import { Check, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { query, request } from "@/lib/request";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

import { NETWORK_POLL_INTERVAL_MS } from "@/components/network/networkReferral";

import { useTranslation } from "@/hooks/useTranslation";

import { ccnMessageRoutes, ccnReferralRoutes } from "@/apis/ccn";
import {
  BecknDiscoverBody,
  NetworkOffer,
  NetworkOfferKind,
  ReferralTransactionRetrieve,
  extractNetworkOffers,
  groupNetworkOffers,
  isAwaitingCallback,
  isFailedTransaction,
  networkOfferValue,
  networkProviderKey,
  networkProviderMatches,
  transactionErrorText,
} from "@/types/ccn";

// Late responders keep answering a broadcast discover for a while.
const RESPONDER_WINDOW_MS = 20_000;

export function NetworkOfferKindBadge({ kind }: { kind: NetworkOfferKind }) {
  const { t } = useTranslation();
  return (
    <Badge
      variant={kind === "coordinator" ? "secondary" : "info"}
      size="xs"
      className="shrink-0"
    >
      {t(`ccn_network_offer_${kind}`)}
    </Badge>
  );
}

interface NetworkDestinationSearchProps {
  selected: NetworkOffer | null;
  /**
   * `null` clears the destination when another provider is picked. `auto` is
   * set when the provider's only offer is preselected: the dropdown stays open.
   */
  onSelect: (offer: NetworkOffer | null, options?: { auto?: boolean }) => void;
  /** Bumped by the parent to search the network again (e.g. after a `70005`). */
  rediscoverKey?: number;
}

/**
 * Finds referral destinations on the CCN network. Discover is not narrowed by
 * service or referral type (referral resources have no service type);
 * appointment offers are dropped. The user picks a provider, then one of its
 * referral units or coordination desks.
 */
export function NetworkDestinationSearch({
  selected,
  onSelect,
  rediscoverKey = 0,
}: NetworkDestinationSearchProps) {
  const { t } = useTranslation();
  const id = useId();
  const [search, setSearch] = useState("");
  const [providerKey, setProviderKey] = useState<string>();
  const [transactionId, setTransactionId] = useState<string>();
  const [startedAt, setStartedAt] = useState(0);
  // Plain state, not `useMutation`: discover starts from a mount effect, and
  // React's dev double-mount detaches a mutation observer from the request
  // in flight, which then stays "pending" forever.
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState(false);
  const discoverRun = useRef(0);
  const runDiscover = useCallback((body: BecknDiscoverBody) => {
    const run = ++discoverRun.current;
    setTransactionId(undefined);
    setDiscovering(true);
    setDiscoverError(false);
    request(ccnReferralRoutes.discover, { body, silent: true }).then(
      (response) => {
        if (run !== discoverRun.current) return;
        setTransactionId(response.transaction_id);
        setStartedAt(Date.now());
        setDiscovering(false);
      },
      () => {
        if (run !== discoverRun.current) return;
        setDiscovering(false);
        setDiscoverError(true);
      },
    );
  }, []);
  const discover = (textSearch: string) => {
    const text = textSearch.trim();
    runDiscover(text ? { text_search: text } : {});
  };
  // Discover as soon as the network destination is chosen, and when asked to again.
  const lastDiscovered = useRef<number>(undefined);
  useEffect(() => {
    if (lastDiscovered.current === rediscoverKey) return;
    lastDiscovered.current = rediscoverKey;
    runDiscover({});
  }, [rediscoverKey, runDiscover]);

  const transactionQuery = useQuery<ReferralTransactionRetrieve>({
    queryKey: ["ccn", "referral", "transaction", transactionId],
    queryFn: query(ccnReferralRoutes.get, {
      pathParams: { transactionId: transactionId ?? "" },
      silent: true,
    }),
    enabled: !!transactionId,
    refetchInterval: (q) =>
      isAwaitingCallback(q.state.data?.status ?? "QUEUED") &&
      Date.now() - startedAt < RESPONDER_WINDOW_MS
        ? NETWORK_POLL_INTERVAL_MS
        : false,
  });
  const status = transactionQuery.data?.status;
  // `select` runs on the same transaction, so later statuses must not hide
  // the providers it already answered with.
  const discovered = !!transactionQuery.data?.actions?.includes("ON_DISCOVER");
  const responded = !!status && (discovered || !isAwaitingCallback(status));
  const failed = !discovered && isFailedTransaction(status);
  const timedOut =
    !!transactionQuery.data &&
    !responded &&
    transactionQuery.dataUpdatedAt - startedAt >= RESPONDER_WINDOW_MS;
  // The stored callbacks, not `catalogs/`: their envelopes carry the network
  // and BAP routing `select` has to send along with the catalog's BPP.
  const messagesQuery = useQuery({
    queryKey: ["ccn", "messages", transactionId, "on_discover"],
    queryFn: query(ccnMessageRoutes.bap, {
      queryParams: {
        transaction_id: transactionId ?? "",
        action: "on_discover",
        direction: "in",
        limit: 50,
      },
      silent: true,
    }),
    enabled: !!transactionId && responded && !failed,
    refetchInterval: () =>
      Date.now() - startedAt < RESPONDER_WINDOW_MS
        ? NETWORK_POLL_INTERVAL_MS * 2
        : false,
  });
  const providers = groupNetworkOffers(
    extractNetworkOffers(messagesQuery.data?.results ?? []),
  );
  // Typing narrows the providers that already answered; Search asks the
  // network again with the text.
  const visibleProviders = providers.filter(
    (provider) =>
      networkProviderMatches(provider, search) ||
      provider.key ===
        (providerKey ?? (selected && networkProviderKey(selected))),
  );
  const activeProviderKey =
    providerKey ?? (selected ? networkProviderKey(selected) : undefined);
  const activeProvider = providers.find(
    (provider) => provider.key === activeProviderKey,
  );
  const selectedValue =
    selected &&
    activeProvider?.offers.some(
      (offer) => networkOfferValue(offer) === networkOfferValue(selected),
    )
      ? networkOfferValue(selected)
      : "";
  const searching =
    discovering ||
    (!!transactionId && !responded && !timedOut && !transactionQuery.isError);

  const pickProvider = (key: string) => {
    setProviderKey(key);
    const provider = providers.find((item) => item.key === key);
    if (!provider) return;
    if (provider.offers.length === 1) {
      onSelect(provider.offers[0], { auto: true });
    } else if (selected && networkProviderKey(selected) !== key) {
      onSelect(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <form
          className="flex min-w-0 flex-1 items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            discover(search);
          }}
        >
          <Field className="min-w-0 flex-1">
            <FieldLabel htmlFor={`${id}-search`}>
              {t("ccn_network_search")}
            </FieldLabel>
            <Input
              id={`${id}-search`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("ccn_network_search_placeholder")}
            />
          </Field>
          <Button type="submit" variant="outline" disabled={discovering}>
            {searching ? (
              <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="size-4" aria-hidden="true" />
            )}
            {t("search")}
          </Button>
        </form>
      </div>
      <div aria-live="polite" className="space-y-2">
        {searching && (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Spinner className="size-4 animate-spin" aria-hidden="true" />
            {t("ccn_searching_network")}
          </p>
        )}
        {(discoverError || transactionQuery.isError) && (
          <FieldError>{t("ccn_network_unavailable")}</FieldError>
        )}
        {failed && (
          <FieldError>
            {t("ccn_network_request_failed", {
              detail:
                transactionErrorText(transactionQuery.data?.last_error) ??
                status,
            })}
          </FieldError>
        )}
        {timedOut && (
          <p role="status" className="text-sm text-muted-foreground">
            {t("ccn_network_no_response")}
          </p>
        )}
        {responded &&
          !failed &&
          !messagesQuery.isPending &&
          !providers.length && (
            <p role="status" className="text-sm text-muted-foreground">
              {t("ccn_no_network_providers")}
            </p>
          )}
        {providers.length > 0 && !visibleProviders.length && (
          <p role="status" className="text-sm text-muted-foreground">
            {t("ccn_no_matching_providers", { search: search.trim() })}
          </p>
        )}
      </div>
      {visibleProviders.length > 0 && (
        <div
          role="radiogroup"
          aria-label={t("ccn_network_providers")}
          className="grid gap-2 sm:grid-cols-2"
        >
          {visibleProviders.map((provider) => {
            const isActive = provider.key === activeProvider?.key;
            return (
              <button
                key={provider.key}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => pickProvider(provider.key)}
                className={cn(
                  "flex min-w-0 items-start gap-2 rounded-lg border border-border bg-background p-3 text-left text-sm hover:bg-muted/50 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring",
                  isActive && "border-primary ring-1 ring-primary",
                )}
              >
                <Check
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 size-4 shrink-0 text-primary",
                    !isActive && "opacity-0",
                  )}
                />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block break-words font-medium">
                    {provider.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[
                      t("ccn_network_services_count", {
                        count: provider.offers.length,
                      }),
                      provider.bppId,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <Badge variant="info" size="xs" className="shrink-0">
                  {t("ccn_network")}
                </Badge>
              </button>
            );
          })}
        </div>
      )}
      {activeProvider && (
        <Field>
          <FieldLabel htmlFor={`${id}-offer`}>
            {t("ccn_network_service")}
          </FieldLabel>
          <Select
            value={selectedValue}
            onValueChange={(value) => {
              const offer = activeProvider.offers.find(
                (item) => networkOfferValue(item) === value,
              );
              if (offer) onSelect(offer);
            }}
          >
            <SelectTrigger id={`${id}-offer`}>
              <SelectValue placeholder={t("ccn_network_service_placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {activeProvider.offers.map((offer) => (
                <SelectItem
                  key={networkOfferValue(offer)}
                  value={networkOfferValue(offer)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">
                      {[
                        offer.offerName ?? offer.offerId,
                        offer.organizationName,
                        ...offer.referralTypes.map((type) =>
                          t(`referral_type_${type}`),
                        ),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <NetworkOfferKindBadge kind={offer.kind} />
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    </div>
  );
}
