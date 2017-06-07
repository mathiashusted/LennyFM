/*
LennyFM 0.9.1
*/

const Discord = require("discord.js");
const yt = require("ytdl-core");
const config = require("./config.json");
const playlist = require("./playlist.json");
const client = new Discord.Client();
const prefix = config.prefix;

var queue = [];
var dispatcher;
var voiceChannel;
var collector = null;
var playing = "";
var playlistOrder = playlist.standard || null;
var playlistPosition = 0;
var playOption = 0; //1: Play specific link from Youtube; 2: Play queue; 3: Play standard

var actions = {

    init: (m, args) => {
        voiceChannel = m.member.voiceChannel;
        if (typeof(voiceChannel) != "undefined") {
            voiceChannel.join().then((connection) => {
                console.log(`LennyFM has joined ${voiceChannel.name}...`);
                if (config.notifications == true) {
                if (config.shufflePlaylist == true) playlistOrder = shuffle(playlistOrder);
                m.channel.sendMessage(`Joined ${voiceChannel.name}`);
            }});
        } else {
            m.channel.sendMessage("Please join a voice channel before initializing.");
        }
    },

    play: (m, args) => {

        if (typeof(voiceChannel) == "undefined") {
            m.channel.sendMessage(`You must initialize the client first with "${prefix} init"`);
            return;
        }

        collector = m.channel.createCollector(m => m);

        if (args[1]) {
            if (args[1].startsWith(config.playlistPrefix)) {
                if (playlist.hasOwnProperty(args[1].slice(1, args[1].length))) {
                    if (config.notifications == true)
                        m.channel.sendMessage(`Found playlist!`);
                    queue = playlist[args[1].slice(1, args[1].length)];

                    if (config.shufflePlaylist == true)
                        queue = shuffle(queue);
                    return actions.play(m, ["play"]);
                }
                else if (args[1] == config.playlistPrefix + config.playlistPrefix) {
                    var allLists = ``;
                    for (var i in playlist) {
                        allLists += `\n- ${i}`;
                    }
                    m.channel.sendMessage(`There are following playlists available:${allLists}`);
                    collector = null;
                    return;
                }
                else {
                    m.channel.sendMessage(`I could not find a playlist with the name ${args[1].slice(1, args[1].length)}! Make sure you type in the name correctly or type in ${config.playlistPrefix + config.playlistPrefix} to view all playlists`);
                    collector = null;
                    return;
                }
            }
            else {
                dispatcher = m.guild.voiceConnection.playStream(yt(args[1]), {audioonly: true});
                queue.unshift(args[1]);
                playing = args[1];
                playOption = 1;
            }
        }
        else if (!args[1] && queue.length != 0) {
            dispatcher = m.guild.voiceConnection.playStream(yt(queue[0]), {audioonly: true});
            playing = queue[0];
            playOption = 2;
        }
        else if (!args[1] && queue.length == 0) {
            playOption = 3;
            if (playlist.standard != []) {
                if (playlistPosition >= playlistOrder.length) {
                    playlistPosition = 0;
                    return actions.play(m, ["play"]);
                }
                dispatcher = m.guild.voiceConnection.playStream(yt(playlistOrder[playlistPosition]));
                playing = playlistOrder[playlistPosition];
                playlistPosition++;
            }
            else {
                m.channel.sendMessage("No songs found in standard playlist");
            }
        }
        else {
            m.channel.sendMessage("No songs found for playback");
            return;
        }

        if (config.notifications) {
            yt.getInfo(playing, (err, info) => {
                if (queue[1]) {
                    yt.getInfo(queue[1], (err2, info2) => {
                        m.channel.sendMessage(`:arrow_forward: Now playing **${info.title}**\n\n:track_next: Next up: *${info2.title}*`);
                    });
                }
                else m.channel.sendMessage(`:arrow_forward: Now playing ${info.title}`);
            });
        }

        collector.on("message", (msg) => {
            var colArgs = parseArguments(msg);

            if (msg.content.startsWith(prefix) == true) {
                
                if (colArgs[0] == "pause") {
                    dispatcher.pause();
                    playing = false;
                    if (config.notifications == true)
                        msg.channel.sendMessage(`Song has been paused. Type "${prefix} resume" to resume.`);
                }
                else if (colArgs[0] == "resume") {
                    dispatcher.resume();
                }
                else if (colArgs[0] == "stop") {
                    dispatcher.end("stop");
                    if (config.notifications)
                        msg.channel.sendMessage(`:stop_button: Playback has been stopped.`);
                }
                else if  (colArgs[0] == "skip") {
                    if (config.notifications)
                        msg.channel.sendMessage(":track_next: Song has been skipped.");
                    dispatcher.end();
                }
                else if (colArgs[0] == "queue") {
                    actions.queue(msg, colArgs);
                }
                else if (colArgs[0] == "help") {
                    actions.help(msg, colArgs);
                }
                else if (colArgs[0] == "clear") {
                    actions.clear(msg, colArgs);
                }
                else if (colArgs[0] == "link") {
                    m.channel.sendMessage(`Currently playing: ${playing}`);
                }
            }
        });

        dispatcher.on("end", (next) => {
            collector.stop();
            collector = null;

            if (next == "stop") {
                if (config.resetQueueOnStop)
                    queue = [];
                return;
            }
            else {
                if (queue.length > 0 && playOption != 3){
                    queue.shift();
                }
                return actions.play(m, ["play"]);
            }
        });
    },

    queue: (m, args) => {
        if (args[1]) {
            if (args[1].startsWith("https://www.youtu")) {
                queue.push(args[1]);
                if (config.notifications)
                    m.channel.sendMessage(`Song *${args[1]}* has been added to queue! Type "${prefix} queue" to view the queue.`);
            }
            else {
                m.channel.sendMessage(`You must enter a Youtube link in this format: "${prefix} queue <LINK>"`);
            }
        }
        else if (typeof(args[1]) == "undefined") {
            var allQueue = ``;
            for (i in queue) {
                if (i == 0)
                    allQueue += `\n:arrow_forward: *${queue[i]}*`;
                else
                    allQueue += `\n:track_next: *${queue[i]}*`;
            }
            if (allQueue == ``)
                m.channel.sendMessage("There are currently no songs in the queue!");
            else
                m.channel.sendMessage(`Current songs in queue:${allQueue}`);
        }
        else {
            m.channel.sendMessage("That didn't work. Are you sure you typed it in correctly? :thinking:");
        }
        return;
    },

    help: (m, args) => {
        m.reply(`currently the available commands are:\n\n**${prefix} init\tInitializes the program and connects to the user's current voice server\n${prefix} play [LINK]\tPlays the provided song(s) or starts the default playlist (to start a custom saved playlist type "${config.playlistPrefix}" in front of the playlist name. Example: "${config.playlistPrefix}jazz")\n${prefix} pause\tPauses the current song\n${prefix} resume\tResumes the current song\n${prefix} skip\tSkips the current song\n${prefix} stop\tStops the current song\n${prefix} link\tProvides the link of the current song\n${prefix} queue <LINK>\tEnqueues the provided song or displays the queue\n${prefix} clear\tClears the queue\n${prefix} stfu\tStops the bot**`);
    },

    clear: (m, args) => {
        queue = [];
        if (config.notifications)
            m.channel.sendMessage("Queue has been cleared!");
    },

    stfu: (m, args) => {
        process.exit();
    }
};


client.on("message", (m) => {
    var args = parseArguments(m);
    if (m.content.startsWith(prefix)) {
        if (config.admins != null) {
            if (!config.admins.includes(m.author.id)) {
                m.reply("you are not an admin!");
                return;
            }
        }
        if (actions.hasOwnProperty(args[0])) {
            if (collector == null) actions[args[0]](m, args);
        }
        else {
            if (collector == null)
                m.channel.sendMessage(`Invalid command! Try "${prefix} help" to see a list of commands`);
        }
    }
});

client.on("ready", () => {
    console.log("Logged in...");
});


function parseArguments(str) {
    str = str.content.split(" ");
    return str.splice(1, str.length);
}

function shuffle(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}

client.login("token");
