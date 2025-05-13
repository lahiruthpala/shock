import React, { useState, useEffect, useCallback } from "react";
import {
    AppBar,
    Toolbar,
    Typography,
    Button,
    Slider,
    Box,
    Container,
    Paper,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField
} from "@mui/material";
import mqtt from "mqtt";

const MqttControl = () => {
    const [client, setClient] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [shockValue, setShockValue] = useState(0);
    const [vibrationValue, setVibrationValue] = useState(0);
    const [error, setError] = useState("");
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);
    const [userName, setUserName] = useState("");
    const [password, setPassword] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [getLocation, setGetLocation] = useState(false);
    const [location, setLocation] = useState(null);
    const [locationAccessGranted, setLocationAccessGranted] = useState(false);
    const [locationSent, setLocationSent] = useState(false)
    const [shockMax, setShockMax] = useState(20);

    const TOPIC = "training_collar";
    const LOCATION_TOPIC = "location_data";

    useEffect(() => {
        // Check for stored password
        const storedPassword = localStorage.getItem('mqtt_password');
        if (!storedPassword) {
            setShowPasswordDialog(true);
        } else {
            setIsAuthenticated(true);
            initializeMqttClient(storedPassword);
        }
    }, []);

    const handlePasswordSubmit = () => {
        if (password) {
            // localStorage.setItem('mqtt_password', password);
            setIsAuthenticated(true);
            setShowPasswordDialog(false);
            initializeMqttClient(password, userName);
        }
    };

    const requestLocationPermission = () => {
        if (!navigator.geolocation) {
            setError("Geolocation is not supported by your browser.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setLocation({ latitude, longitude });
                setLocationAccessGranted(true);
            },
            (error) => {
                setError("Location access denied. Please enable location services.");
                setLocationAccessGranted(false);
            }
        );
    };

    const initializeMqttClient = (mqttPassword, userName) => {
        console.log("Initializing MQTT client...", mqttPassword, userName)
        const mqttClient = mqtt.connect("wss://lfa12ed4.ala.asia-southeast1.emqxsl.com:8084/mqtt", {
            clientId: `mqtt-client-${Math.random().toString(16).substr(2, 8)}`,
            username: userName,
            password: mqttPassword,
            keepalive: 60,
            reconnectPeriod: 1000,
            connectTimeout: 30 * 1000,
            clean: true
        });

        mqttClient.on("connect", () => {
            console.log("Connected to MQTT broker");
            setIsConnected(true);
            setError("");

            // Subscribe to a topic where retained values exist
            const topic = "settings";  // Replace with your actual topic
            mqttClient.subscribe(topic, { qos: 1 }, (err) => {
                if (err) {
                    console.error("Subscription error:", err);
                } else {
                    console.log(`Subscribed to ${topic}`);
                }
            });
        });

        mqttClient.on("error", (err) => {
            console.error("Connection error:", err);
            setError("Connection error: " + err.message);
            setIsConnected(false);

            // If authentication fails, clear stored password and show dialog
            if (err.message.includes("auth")) {
                localStorage.removeItem('mqtt_password');
                setIsAuthenticated(false);
                setShowPasswordDialog(true);
            }
        });

        mqttClient.on("message", (topic, message, packet) => {
            const payload = message.toString();
            console.log(`Received message: ${payload} on topic: ${topic}`);

            let data;
            try {
                data = JSON.parse(payload);
            } catch (err) {
                console.error("Failed to parse payload as JSON:", err);
                return;
            }

            try {
                if (packet.retain) {
                    console.log("This message is retained!");
                    setShockMax(data.shockMax);
                    setGetLocation(data.getLocation)
                }
            } catch (err) {
                console.error("Failed to parse payload as JSON:", err);
            }
        });

        mqttClient.on("offline", () => {
            console.log("Client went offline");
            setIsConnected(false);
            setError("Client offline - trying to reconnect...");
        });

        mqttClient.on("reconnect", () => {
            console.log("Attempting to reconnect...");
            setError("Attempting to reconnect...");
        });

        setClient(mqttClient);

        return () => {
            if (mqttClient) {
                mqttClient.end(true, {}, () => {
                    console.log("Disconnected from MQTT broker");
                });
            }
        };
    };

    const sendShockMessage = useCallback(() => {
        const message = JSON.stringify({ id: 1, mode: "S", value: shockValue });
        return sendMessage(message, "shock")
    }, [client, isConnected, shockValue]);

    const sendVibrationMessage = useCallback(() => {
        const message = JSON.stringify({ id: 1, mode: "V", value: vibrationValue });
        return sendMessage(message, "vibration")
    }, [client, isConnected, vibrationValue]);

    const sendMessage = (message, type) => {
        if(!locationAccessGranted && getLocation) {
            requestLocationPermission();
            return;
        }
        let locationMessage = null;
        try{
            if(getLocation){
                locationMessage = JSON.stringify({ userName: userName, latitude: location.latitude, longitude: location.longitude });
            }
        }catch(err){
            console.error("Failed to location data:", err);
        }

        if (!client || !isConnected) {
            setError("Client not connected. Please wait...");
            return;
        }
        console.log("Sending message:", message, locationMessage);

        try {
            if(!locationSent && getLocation) {
                client.publish(LOCATION_TOPIC, locationMessage, {qos: 1, retain: true}, (err) => {
                    if (err) {
                        console.error("Failed to publish command:", err);
                        setError("Failed to send command: " + err.message);
                    } else {
                        console.log("command sent successfully:", message);
                        setError("");
                    }
                });
                setLocationSent(true);
            }
            client.publish(TOPIC, message, { qos: 1 }, (err) => {
                if (err) {
                    console.error(`Failed to publish ${type} command:`, err);
                    setError(`Failed to send ${type} command: ` + err.message);
                } else {
                    console.log(`${type} command sent successfully:`, message);
                    setError("");
                }
            });
        } catch (err) {
            console.error(`Error publishing ${type} command:`, err);
            setError(`Error sending ${type} command: ` + err.message);
        }
    }

    if (!isAuthenticated) {
        return (
            <Dialog open={showPasswordDialog} onClose={() => {}} disableEscapeKeyDown>
                <DialogTitle>Enter User Name</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="UserName"
                        type="Text"
                        fullWidth
                        variant="outlined"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                    />
                </DialogContent>
                <DialogTitle>Enter Password</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Password"
                        type="password"
                        fullWidth
                        variant="outlined"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handlePasswordSubmit} variant="contained" color="primary">
                        Connect
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }

    return (
        <Box sx={{ minHeight: "100vh", bgcolor: "#f4f4f4" }}>
            <AppBar position="static" color="primary" elevation={1}>
                <Toolbar>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        Shock Collar App
                    </Typography>
                    <Box sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: isConnected ? 'success.main' : 'error.main',
                        mr: 2
                    }} />
                </Toolbar>
            </AppBar>

            <Container maxWidth="sm" sx={{ mt: 4 }}>
                {error && (
                    <Typography color="error" align="center" sx={{ mb: 2 }}>
                        {error}
                    </Typography>
                )}

                <Typography variant="h5" align="center" gutterBottom>
                    Control Panel
                </Typography>

                <Typography variant="body2" align="center" sx={{ mb: 3 }} color={isConnected ? 'success.main' : 'error.main'}>
                    Status: {isConnected ? "Connected" : "Disconnected"}
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {/* Shock Control Section */}
                    <Paper sx={{ p: 3, bgcolor: "white", borderRadius: 2 }}>
                        <Typography variant="h6" gutterBottom>
                            Shock Control
                        </Typography>
                        <Slider
                            value={shockValue}
                            onChange={(e, value) => setShockValue(value)}
                            aria-labelledby="shock-slider"
                            disabled={!isConnected}
                            min={0}
                            max={shockMax}
                            step={1}
                            sx={{ mb: 2 }}
                        />
                        <Typography variant="body1" sx={{ mb: 2 }}>
                            Shock Value: <strong>{shockValue}</strong>
                        </Typography>
                        <Button
                            variant="contained"
                            color="secondary"
                            fullWidth
                            disabled={!isConnected}
                            onClick={sendShockMessage}
                        >
                            Send Shock Command
                        </Button>
                    </Paper>

                    {/* Vibration Control Section */}
                    <Paper sx={{ p: 3, bgcolor: "white", borderRadius: 2 }}>
                        <Typography variant="h6" gutterBottom>
                            Vibration Control
                        </Typography>
                        <Slider
                            value={vibrationValue}
                            onChange={(e, value) => setVibrationValue(value)}
                            aria-labelledby="vibration-slider"
                            disabled={!isConnected}
                            min={0}
                            max={100}
                            step={1}
                            sx={{ mb: 2 }}
                        />
                        <Typography variant="body1" sx={{ mb: 2 }}>
                            Vibration Value: <strong>{vibrationValue}</strong>
                        </Typography>
                        <Button
                            variant="contained"
                            color="primary"
                            fullWidth
                            disabled={!isConnected}
                            onClick={sendVibrationMessage}
                        >
                            Send Vibration Command
                        </Button>
                    </Paper>
                </Box>
            </Container>
        </Box>
    );
};

export default MqttControl;
