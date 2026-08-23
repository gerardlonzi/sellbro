import { useState, useEffect } from "react";
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet, Modal } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLangue, t } from "@/lib/i18n";
import { ConfigFiltre, ValeursFiltre, VALEURS_FILTRE_VIDES } from "@/lib/filtres/types";

export function PanneauFiltre({
  visible,
  config,
  valeurs,
  onFermer,
  onAppliquer,
}: {
  visible: boolean;
  config: ConfigFiltre;
  valeurs: ValeursFiltre;
  onFermer: () => void;
  onAppliquer: (v: ValeursFiltre) => void;
}) {
  const { colors } = useTheme();
  const { langue } = useLangue();
  const [brouillon, setBrouillon] = useState<ValeursFiltre>(valeurs);

  useEffect(() => {
    if (visible) setBrouillon(valeurs);
  }, [visible]);

  function majChamp<K extends keyof ValeursFiltre>(cle: K, v: ValeursFiltre[K]) {
    setBrouillon((prev) => ({ ...prev, [cle]: v }));
  }

  function appliquer() {
    onAppliquer(brouillon);
    onFermer();
  }

  function reinitialiser() {
    setBrouillon(VALEURS_FILTRE_VIDES);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onFermer}>
      <Pressable style={styles.fond} onPress={onFermer}>
        <Pressable style={[styles.feuille, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.entete}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textPrimary }}>{t("filtre_titre", langue)}</Text>
            <Pressable onPress={onFermer}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 420 }}>
            {config.tri && (
              <Section titre={t("filtre_trier_par", langue)}>
                <View style={styles.puces}>
                  {config.tri.map((o) => (
                    <Puce key={o.valeur} label={t(o.labelCle as any, langue)} actif={brouillon.tri === o.valeur} onPress={() => majChamp("tri", o.valeur)} colors={colors} />
                  ))}
                </View>
              </Section>
            )}

            {config.statut && (
              <Section titre={t("filtre_statut", langue)}>
                <View style={styles.puces}>
                  {config.statut.map((o) => (
                    <Puce key={o.valeur} label={t(o.labelCle as any, langue)} actif={brouillon.statut === o.valeur} onPress={() => majChamp("statut", o.valeur)} colors={colors} />
                  ))}
                </View>
              </Section>
            )}

            {config.paiement && (
              <Section titre={t("commandes_paiement_tous", langue) === undefined ? "" : "Paiement"}>
                <View style={styles.puces}>
                  {config.paiement.map((o) => (
                    <Puce key={o.valeur} label={t(o.labelCle as any, langue)} actif={brouillon.paiement === o.valeur} onPress={() => majChamp("paiement", o.valeur)} colors={colors} />
                  ))}
                </View>
              </Section>
            )}

            {config.avecPeriode && (
              <Section titre={t("filtre_periode", langue)}>
                <View style={styles.puces}>
                  {[
                    { valeur: "tous", labelCle: "commandes_filtre_tous" },
                    { valeur: "aujourdhui", labelCle: "filtre_periode_aujourdhui" },
                    { valeur: "semaine", labelCle: "filtre_periode_semaine" },
                    { valeur: "mois", labelCle: "filtre_periode_mois" },
                    { valeur: "personnalisee", labelCle: "filtre_periode_personnalisee" },
                  ].map((o) => (
                    <Puce key={o.valeur} label={t(o.labelCle as any, langue)} actif={brouillon.periode === o.valeur} onPress={() => majChamp("periode", o.valeur)} colors={colors} />
                  ))}
                </View>
                {brouillon.periode === "personnalisee" && (
                  <View style={styles.ligneDeuxChamps}>
                    <TextInput
                      placeholder={t("filtre_date_debut", langue)}
                      placeholderTextColor={colors.textMuted}
                      value={brouillon.dateDebut}
                      onChangeText={(v) => majChamp("dateDebut", v)}
                      style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.textPrimary }]}
                    />
                    <TextInput
                      placeholder={t("filtre_date_fin", langue)}
                      placeholderTextColor={colors.textMuted}
                      value={brouillon.dateFin}
                      onChangeText={(v) => majChamp("dateFin", v)}
                      style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.textPrimary }]}
                    />
                  </View>
                )}
              </Section>
            )}

            {config.avecMontant && (
              <Section titre={t("filtre_montant", langue)}>
                <View style={styles.ligneDeuxChamps}>
                  <TextInput
                    placeholder={t("filtre_montant_min", langue)}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={brouillon.montantMin}
                    onChangeText={(v) => majChamp("montantMin", v)}
                    style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.textPrimary }]}
                  />
                  <TextInput
                    placeholder={t("filtre_montant_max", langue)}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={brouillon.montantMax}
                    onChangeText={(v) => majChamp("montantMax", v)}
                    style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.textPrimary }]}
                  />
                </View>
              </Section>
            )}
          </ScrollView>

          <View style={styles.bas}>
            <Pressable onPress={reinitialiser} style={styles.boutonReinit}>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("filtre_reinitialiser", langue)}</Text>
            </Pressable>
            <Pressable onPress={appliquer} style={[styles.boutonAppliquer, { backgroundColor: colors.accent }]}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{t("filtre_appliquer", langue)}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ fontSize: 11, color: colors.textMuted, textTransform: "uppercase", marginBottom: 8 }}>{titre}</Text>
      {children}
    </View>
  );
}

function Puce({ label, actif, onPress, colors }: { label: string; actif: boolean; onPress: () => void; colors: any }) {
  return (
    <Pressable onPress={onPress} style={[styles.puce, { borderColor: actif ? colors.accent : colors.border, borderWidth: actif ? 1.5 : 1 }]}>
      <Text style={{ fontSize: 12, color: actif ? colors.accent : colors.textPrimary }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  feuille: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 18, paddingBottom: 30 },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  puce: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  ligneDeuxChamps: { flexDirection: "row", gap: 8, marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 13 },
  bas: { flexDirection: "row", gap: 10, marginTop: 10 },
  boutonReinit: { flex: 1, alignItems: "center", justifyContent: "center" },
  boutonAppliquer: { flex: 2, paddingVertical: 13, borderRadius: 10, alignItems: "center" },
});