const Game = require('./db/models/Game');

const mapHelper = require('./map');
const playerHelper = require('./player');

const SELECTS = {
    INFO: {
        settings: 1,
        state: 1
    },
    SETTINGS: {
        settings: 1
    },
    GALAXY: {
        galaxy: 1
    }
};

module.exports = {

    listOfficialGames(callback) {
        Game.find({
            'settings.general.createdByUserId': { $eq: null }
        })
            .select(SELECTS.INFO)
            .exec((err, docs) => {
                if (err) {
                    return callback(err);
                }

                return callback(null, docs);
            });
    },

    listUserGames(callback) {
        Game.find({
            'settings.general.createdByUserId': { $ne: null }
        })
            .select(SELECTS.INFO)
            .exec((err, docs) => {
                if (err) {
                    return callback(err);
                }

                return callback(null, docs);
            });
    },

    getById(id, select, callback) {
        Game.findById(id)
            .select(select)
            .exec((err, doc) => {
                if (err) {
                    return callback(err);
                }

                return callback(null, doc);
            });
    },

    getByIdAll(id, callback) {
        return module.exports.getById(id, {}, callback);
    },

    getByIdInfo(id, callback) {
        return module.exports.getById(id, SELECTS.INFO, callback);
    },

    getByIdGalaxy(id, callback) {
        // TODO: Get from the user's perspective. i.e filter out stars that are not in scanning range.
        return module.exports.getById(id, SELECTS.GALAXY, callback);
    },

    getByIdGalaxy(id, userId, callback) {
        // TODO: Get from the user's perspective. i.e filter out stars that are not in scanning range.
        return module.exports.getById(id, SELECTS.GALAXY, (err, doc) => {
            if (err) {
                return callback(err);
            }

            doc = doc.toObject();

            // Check if the user is playing in this game.
            let player = doc.galaxy.players.find(x => x.userId === userId);

            // if the user isn't playing this game, then return all data.
            // TODO: Should not allow this as it can easily be abused.
            if (!player) {
                return callback(null, doc);
            }

            let scanningRangeDistance = mapHelper.getScanningDistance(player.research.scanning);

            // Get all of the players stars.
            let playerStars = doc.galaxy.stars.filter(s => s.ownedByPlayerId && s.ownedByPlayerId.equals(player._id));

            // Work out which ones are not in scanning range and clear their data.
            doc.galaxy.stars = doc.galaxy.stars
                .map(s => {
                    // Ignore stars the player owns, they will always be visible.
                    let isOwnedByPlayer = playerStars.find(y => y._id.equals(s._id));

                    if (isOwnedByPlayer) {
                        return s;
                    }

                    // Get the closest player star to this star.
                    let closest = mapHelper.getClosestStar(s, playerStars);
                    let distance = mapHelper.getDistanceBetweenStars(s, closest);

                    let inRange = distance <= scanningRangeDistance;

                    // If its in range then its all good, send the star back as is.
                    // Otherwise only return a subset of the data.
                    if (inRange) {
                        return s;
                    } else {
                        return {
                            _id: s._id,
                            name: s.name,
                            ownedByPlayerId: s.ownedByPlayerId,
                            location: s.location
                        }
                    }
                });

            return callback(null, doc);
        });
    },

    create(settings, callback) {
        let game = new Game({
            settings
        });

        // Calculate how many stars we need.
        game._doc.state.stars = game._doc.settings.galaxy.starsPerPlayer * game._doc.settings.general.playerLimit * 2.5;
        game._doc.state.starsForVictory = (game._doc.state.stars / 100) * game._doc.settings.general.starVictoryPercentage;

        // Create all of the stars required.
        game._doc.galaxy.stars = mapHelper.generateStars(game._doc.state.stars);

        // Setup players and assign to their starting positions.
        game._doc.galaxy.players = playerHelper.createEmptyPlayers(game._doc.settings, game._doc.galaxy.stars);

        game.save((err, doc) => {
            if (err) {
                return callback(err);
            }

            callback(null, doc);
        });
    },

    join(gameId, userId, playerId, raceId, alias, callback) {
        module.exports.getById(gameId, {}, (err, game) => {
            if (err) {
                return callback(err);
            }

            // Get the player and update it to assign the user to the player.
            let player = game.galaxy.players.find(x => {
                return x._id == playerId;
            });

            player.userId = userId;
            player.raceId = raceId;
            player.alias = alias;

            game.save((err, doc) => {
                if (err) {
                    return callback(err);
                }

                return callback(null, doc);
            });
        });
    }
};
