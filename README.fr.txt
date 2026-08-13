Contrôle du réseau, Détection de présence, Surveillance de l'énergie

Application pour faire interagir Homey avec les routeurs Netgear.
- Surveillez et contrôlez votre réseau wifi et ses appareils connectés
- Bloquez le wifi de vos enfants après le dîner
- Détection de présence basée sur le wifi du smartphone
- Surveillez la consommation d'énergie de vos appareils réseau, par ex. la télévision

Voir et enregistrer :
- statut de la connexion internet
- vitesse de téléchargement et d'envoi internet
- statut de connexion des appareils connectés
- qualité du wifi et bande passante par appareil
- consommation d'énergie par appareil

Réagir à :
- appareil se connectant ou se déconnectant (présence)
- changement de bande passante ou de liaison wifi d'un appareil
- détection d'un appareil inconnu se connectant au réseau
- alarme lorsque la connexion internet s'interrompt
- changement de vitesse de téléchargement/envoi internet
- résultats du test de vitesse internet
- nouveau firmware de routeur disponible

Faire :
- envoyer WakeOnLan (WOL) à une adresse MAC
- bloquer et autoriser un appareil connecté par adresse MAC
- activer et désactiver le wifi invité
- effectuer un test de vitesse internet
- effectuer la mise à niveau du firmware
- redémarrer le routeur


Configuration du routeur dans Homey :
L'application est destinée aux appareils Netgear fonctionnant en mode Routeur. En mode Point d'accès (AP), vous n'aurez pas toutes les fonctionnalités, comme les statistiques de trafic. Votre Homey doit être connecté sur le LAN du routeur. Pour configurer, allez dans "Appareils" et ajoutez le routeur Netgear en saisissant le mot de passe administrateur.

Détection de présence :
Après avoir ajouté votre routeur à Homey, vous pouvez ajouter les appareils mobiles que vous souhaitez suivre pour la présence selon leur connexion wifi.

Surveillance de l'énergie :
Après avoir ajouté votre routeur à Homey, vous pouvez ajouter des appareils supplémentaires dont vous souhaitez surveiller la consommation électrique (ex. TV ou imprimante).

Routeurs pris en charge :
En général, si vous pouvez utiliser l'application Nighthawk ou Orbi pour gérer le routeur, cette application Homey fonctionnera très probablement.

Test de compatibilité :
Si votre routeur ne fonctionne pas correctement avec cette application, vous pouvez effectuer un test de compatibilité depuis l'onglet des paramètres de l'application.
