import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function HelpScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Komme i gang</Text>
        <Text style={styles.text}>Opprett en bigård fra startsiden, og legg deretter til kuber under den.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>Inspeksjoner</Text>
        <Text style={styles.text}>Åpne en kube for å registrere inspeksjon, behandling, fôring eller produksjon.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>Tilkobling</Text>
        <Text style={styles.text}>Appen bruker Birøkt-tjenesten på Raspberry Pi. Telefonen må være på samme nettverk eller koblet til Tailscale.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#f3f4f6', flexGrow: 1, padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 14, padding: 16 },
  title: { color: '#1f2937', fontSize: 17, fontWeight: '700', marginBottom: 6 },
  text: { color: '#4b5563', fontSize: 15, lineHeight: 22 },
});
