require('dotenv').config();

const Snoowrap = require('snoowrap');
const Snoostorm = require('snoostorm');
var mongoose     = require('mongoose');
var findOrCreate = require('mongoose-find-or-create');
var cron         = require('node-cron');
var slug         = require('slug');

var Reddit_Post         = require('./models/Reddit_Post');
var Reddit_Comment_User = require('./models/Reddit_Comment_User');
var Group               = require('./models/Group');
var Group_Mvp           = require('./models/Group_Mvp');
var User                = require('./models/User');
mongoose.connect(process.env.MONGOOSE);

const r = new Snoowrap({
    userAgent: process.env.USER_AGENT,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REDDIT_TOKEN
});
/*
const r = new Snoowrap({
    userAgent: process.env.USER_AGENT,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    username: process.env.REDDIT_USER,
    password: process.env.REDDIT_PASS
});
*/
const client = new Snoostorm(r);

/*
// Configure options for stream: subreddit & results per query
const streamOpts = {
    subreddit: "testingground4bots",
    //subreddit: 'anime',
    results: 25
};
  
// Create a Snoostorm CommentStream with the specified options
const comments = client.CommentStream(streamOpts);

// On comment, perform whatever logic you want to do
comments.on('comment', (comment) => {
    console.log(comment);
});
*/

var submissionStream = client.SubmissionStream({
  "subreddit": process.env.SUBREDDIT, // optional, defaults to "all",
  "results": 20,        // The number of results to request per request, more the larger the subreddit, about how many results you should get in 2 seconds. Defaults to 5
  "pollTime": 60000
});

submissionStream.on("submission", function(post) {
  handle_new_posts(post);
});

cron.schedule('7,17,37,47 * * * *', function(){
  r.getNew(process.env.SUBREDDIT).then(function(posts){
    if (posts && posts.length > 0) {
      for (var i in posts) {
        if (posts[i] && posts[i].title && posts[i].title.toLowerCase().indexOf(process.env.PARSE_TEXT) == -1) {
          handle_new_posts(posts[i]);
        }
      }
    }
  });
});

module.exports.manual_fix_post = function (post_id) {
  r.getSubmission(post_id).expandReplies({limit: Infinity, depth: Infinity}).then(function(post){
    handle_new_posts(post);
  });
};

function handle_new_posts(post) {
  if ((post.title && post.title.toLowerCase().indexOf(process.env.PARSE_TEXT) >= 0) 
      || post.link_flair_text == "Rewatch") {
      
    var title_notag = post.title;
    title_notag = title_notag.replace("[Rewatch]", "");
    title_notag = title_notag.replace("[Spoilers]", "");
    var is_start_group = true;
    var is_discuss_thread = false;
    var rewatch_title = '';
      
    if (title_notag.match(/interest|schedule/i)) {
      rewatch_title = title_notag; 
        
      if (title_notag.toLowerCase().indexOf("interest for an ") >= 0) {
        rewatch_title = title_notag.substring(title_notag.toLowerCase().indexOf("interest for an ") + 16);
      } else if (title_notag.toLowerCase().indexOf("interest for a ") >= 0) {
        rewatch_title = title_notag.substring(title_notag.toLowerCase().indexOf("interest for a ") + 15);
      } else if (title_notag.toLowerCase().indexOf("interest for ") >= 0) {
        rewatch_title = title_notag.substring(title_notag.toLowerCase().indexOf("interest for ") + 13);
      } else if (title_notag.toLowerCase().indexOf("interested for an ") >= 0) {
        rewatch_title = title_notag.substring(title_notag.toLowerCase().indexOf("interested for an ") + 18);
      } else if (title_notag.toLowerCase().indexOf("interested for a ") >= 0) {
        rewatch_title = title_notag.substring(title_notag.toLowerCase().indexOf("interested for a ") + 17);
      } else if (title_notag.toLowerCase().indexOf("interested for ") >= 0) {
        rewatch_title = title_notag.substring(title_notag.toLowerCase().indexOf("interested for ") + 15);
      } else if (title_notag.match(/ - | episode| movie| ova | season /i)) {
          
      var match_res = title_notag.match(/ - | episode| movie| ova | season /i);
      rewatch_title = title_notag.substring(0, match_res.index).trim();
        
      is_discuss_thread = true;
    }
    
    rewatch_title = rewatch_title.replace(/rewatch/gi, "").trim();  
      
    if (!post.title.match(/\[Rewatch\]/i) && post.link_flair_text != "Rewatch") is_start_group = false;
      
    var group_slug = ''    
        
    if (is_start_group && rewatch_title != '') {
      group_slug = slug(post.author.name + ' ' + rewatch_title);
        
      Group.findOrCreate({ 
          slug: group_slug 
      }, 
      {
          slug        : group_slug,
          name        : rewatch_title,
          admins      : [post.author.name],
          series_slugs: [],
          is_active   : true,
          is_bot_made : true,
          //start_time  : start_time,
          create_time : Date.now(),
          update_time : Date.now(),
          attending_users_count: 0,
          post_count: 1
      },
      function (err, group) {
        if( err ) return console.log( err );
          
        if (post.id) {
          Reddit_Post.findOne ({
              id: post.id
          },
          function (err, reddit_post) {
            if( err ) return console.log( err );
                  
            if (!reddit_post) {
              new Reddit_Post({
                  id           : post.id,
                  title        : post.title,
                  subreddit    : post.subreddit.display_name,
                  reddit_name  : post.author.name,
                  url          : post.url,
                  //series_slug  : String,
                  group_slug   : group_slug,
                  comment_count: post.num_comments,
                  score        : post.score,
                  //comments_over_time: [],
                  //score_over_time: [],
                  is_notified  : false,
                  is_private_messaged: false,
                  is_discuss_thread: is_discuss_thread,
                  create_time  : Date.now(),
                  update_time  : Date.now()
              }).save( function ( err, group_schedule, count ){
                if( err ) return console.log( err );
                  
                if (group) {
                  query_reddit_posts = Reddit_Post.count({group_slug: group_slug});
                  var promise_reddit_posts = query_reddit_posts.exec();

                  promise_reddit_posts.then(function (reddit_posts_val) {
                    if (reddit_posts_val) {
                      Group.update({
                        slug : group.slug
                      }, {
                        $set: { 
                            post_count: reddit_posts_val,
                            update_time : Date.now() 
                        }
                      }, function (err, updated_group) {
                        if( err ) return console.log( err );
                      });
                    }
                  });
                }
              });
            }
          });
        }
      });
    } else {
      if (post.id) {
        Reddit_Post.findOne ({
            id: post.id
        },
        function (err, reddit_post) {
          if( err ) return console.log( err );
                  
          if (!reddit_post) {
            new Reddit_Post({
                id           : post.id,
                title        : post.title,
                subreddit    : post.subreddit.display_name,
                reddit_name  : post.author.name,
                url          : post.url,
                //series_slug  : String,
                group_slug   : group_slug,
                comment_count: post.num_comments,
                score        : post.score,
                //comments_over_time: [],
                //score_over_time: [],
                is_notified  : false,
                is_private_messaged: false,
                is_discuss_thread: is_discuss_thread,
                create_time  : Date.now(),
                update_time  : Date.now()
            }).save( function ( err, group_schedule, count ){
              if( err ) return console.log( err );
            });
          }
        });
      }
    }
  }
}

cron.schedule('15,45 * * * *', function(){
  //console.log('cronjob update reddit posts');
  var d1 = new Date();
    
  d1.setDate(d1.getDate() - 1);
    
  var query_reddit_post = Reddit_Post.find({
      create_time : {$gt: d1}
  });
  var promise_reddit_post = query_reddit_post.exec();
    
  promise_reddit_post.then(function (reddit_posts) {
    for (i=0; i<reddit_posts.length; i++) {
      var reddit_post = reddit_posts[i];
        
      if (reddit_post.id) {
        update_post_from_reddit(reddit_post.id, reddit_post.group_slug, reddit_post.title);  
      }
    }
  });
  
  function update_post_from_reddit(reddit_post_id, reddit_post_group_slug, reddit_post_title) {
        
    r.getSubmission(reddit_post_id).expandReplies({limit: Infinity, depth: Infinity}).then(function(post){
      if (post.selftext == '[deleted]' || post.selftext == '[removed]') {
        Reddit_Post.remove({
            id: post.id
        }, function (err, deleted_post) {
          if( err ) return console.log( err );
        });     
      } else {
          
        Reddit_Post.update({
            id: post.id
        }, {
            $push: { 
                comments_over_time: post.num_comments,
                score_over_time: post.score
            },
            $set: { 
                comment_count: post.num_comments,
                score        : post.score,
                update_time : Date.now() 
            }
        }, function (err, updated_reddit_post) {
          if( err ) return console.log( err );
        });
            
        var comment_last_times = {};
        var comment_score_totals = {};
        var best_comments = {};
        var best_comment_urls = {};
        var best_comment_scores = {};

        if (typeof post.comments != 'undefined' && post.comments.length > 0) {
                
          for (var post_val in post.comments) {
            if (post.comments[post_val] && post_val != '_r') {
              if (typeof post.comments[post_val].author != 'undefined') {
                    
                var author_name = post.comments[post_val].author.name;
                if (author_name != '[deleted]' && author_name != '[removed]') {
                  var created_utc = post.comments[post_val].created_utc;
                  var score = post.comments[post_val].score;  
                    
                  if (typeof comment_last_times[author_name] == 'undefined' || 
                        comment_last_times[author_name] < created_utc)
                    comment_last_times[author_name] = created_utc;
                      
                  if (typeof comment_score_totals[author_name] == 'undefined')
                    comment_score_totals[author_name] = score;
                  else
                    comment_score_totals[author_name] += score;
                    
                  if (typeof best_comment_scores[author_name] == 'undefined' || 
                        best_comment_scores[author_name] < score) {
                    best_comment_scores[author_name] = score;
                    best_comment_urls[author_name] = post.comments[post_val].permalink;
                    var no_spoilers_body = post.comments[post_val].body.replace(/\(\/s.*?\)/i,"(Spoilers)");
                    best_comments[author_name] = no_spoilers_body.substring(0, 280);
                  }
                }
              }
                    
              if (
                  typeof post.comments[post_val].replies != 'undefined' &&
                  post.comments[post_val].replies.length > 0
              ) {
                for (var replies_val in post.comments[post_val].replies) {
                  if (post.comments[post_val].replies[replies_val] && 
                        typeof post.comments[post_val].replies[replies_val].author != 'undefined') {
                          
                    var author_name = post.comments[post_val].replies[replies_val].author.name;
                    if (author_name != '[deleted]' && author_name != '[removed]') {
                      var created_utc = post.comments[post_val].replies[replies_val].created_utc;
                      var score = post.comments[post_val].replies[replies_val].score;
                          
                      if (typeof comment_last_times[author_name] == 'undefined' || 
                          comment_last_times[author_name] < created_utc) 
                        comment_last_times[author_name] = created_utc;
                         
                      if (typeof comment_score_totals[author_name] == 'undefined')
                        comment_score_totals[author_name] = score;
                      else 
                        comment_score_totals[author_name] += score;
                        
                      if (typeof best_comment_scores[author_name] == 'undefined' || 
                          best_comment_scores[author_name] < score) {
                        best_comment_scores[author_name] = score;
                        best_comment_urls[author_name] = post.comments[post_val].replies[replies_val].permalink;
                        var no_spoilers_body = post.comments[post_val].replies[replies_val].body.replace(/\(\/s.*?\)/i,"(Spoilers)");
                        best_comments[author_name] = no_spoilers_body.substring(0, 140);
                      }
                    }
                  }
                } 
              }
            }
          } 
                
          for (var post_val in post.comments) {
            if (post.comments[post_val] && post_val != '_r') {
              if (typeof post.comments[post_val].author != 'undefined') {
                if (post.comments[post_val].body.toLowerCase().indexOf("[follow]") >= 0 || post.comments[post_val].body.toLowerCase().indexOf("remindme") >= 0) {
                  var author_name = post.comments[post_val].author.name;
                  var comment_time = new Date(post.comments[post_val].created_utc);
                  var comment_last_time = new Date(comment_last_times[author_name]);
                        
                  handle_follow_comments(author_name, comment_last_time, comment_time, post.id, reddit_post_group_slug, reddit_post_title);
                }
                if (
                    typeof post.comments[post_val].replies != 'undefined' &&
                    post.comments[post_val].replies.length > 0
                ) {
                  for (var replies_val in post.comments[post_val].replies) {
                      
                    if (post.comments[post_val].replies[replies_val] && 
                        typeof post.comments[post_val].replies[replies_val].body != 'undefined') {
                      if (post.comments[post_val].replies[replies_val].body.toLowerCase().indexOf("[mvp]") >= 0) {
                        var author_name = post.comments[post_val].author.name;
                        var voter_name = post.comments[post_val].replies[replies_val].author.name;
                        
                        handle_mvp_comments(author_name, voter_name, reddit_post_group_slug);
                      }
                    }
                  }
                }
              }
            }
          }
        }
          
        Object.keys(comment_last_times).forEach(function(comment_user_name) {
          var comment_last_time   = comment_last_times[comment_user_name];
          var comment_score_total = comment_score_totals[comment_user_name];
          var best_comment        = best_comments[comment_user_name];
          var best_comment_score  = best_comment_scores[comment_user_name];
          var best_comment_url    = best_comment_urls[comment_user_name];
              
          Reddit_Comment_User.findOne ({
              reddit_post_id: post.id,
              reddit_name: comment_user_name
          },
          function (err, user) {
            if( err ) return console.log( err );
                  
            if (user) {
              var d1 = new Date(comment_last_time*1000);  
              var d2 = new Date(user.last_comment_time);  
                  
              if (d1.getTime() >= d2.getTime()) {
                    
                Reddit_Comment_User.update({
                    reddit_post_id: post.id,
                    reddit_name: comment_user_name
                }, {
                    $set: { 
                        last_comment_time: d1,
                        score_total: comment_score_total,
                        update_time   : Date.now()
                    }
                }, 
                function (err, updated_comment_user) {
                  if( err ) return console.log( err );
                        
                  var add_score = comment_score_total - user.score_total;
                  if (reddit_post_group_slug && add_score != 0)
                    update_group_mvp(comment_user_name, reddit_post_group_slug, add_score, best_comment, best_comment_score, best_comment_url);
                });
              }
            } else {
              var d1 = new Date(comment_last_time*1000);  
                  
              Reddit_Comment_User.create({
                  reddit_post_id: post.id,
                  reddit_name: comment_user_name,
                  score_total: comment_score_total,
                  first_comment_time: d1,
                  last_comment_time: d1,
                  create_time   : Date.now(),
                  update_time   : Date.now(),
                  is_notified   : false
              }, 
              function (err, new_comment_user) {
                if( err ) return console.log( err );
                    
                if (reddit_post_group_slug && comment_score_total != 0)
                  update_group_mvp(comment_user_name, reddit_post_group_slug, comment_score_total, best_comment, best_comment_score, best_comment_url);
              });
            }
          });
        });
      }
    }).catch(function(err) {
      console.log(err);
    });
  }
    
  function handle_follow_comments(comment_author_name, comment_last_time, comment_time, reddit_post_id, reddit_post_group_slug, reddit_post_title) {
                            
    if (comment_time.getTime() >= comment_last_time.getTime() && (Date.now() - comment_time.getTime()*1000) < 1800000) {
                              
      User.findOrCreate({ name: comment_author_name, reddit_name: comment_author_name }, function (err, user) {
        if (reddit_post_group_slug) {
          var query_group = Group.findOne({slug : reddit_post_group_slug});
          var promise_group = query_group.exec();
              
          promise_group.then(function (group) {
            var new_attending_users = group.attending_users.slice(0);
      
            if (new_attending_users.indexOf(user.name) == -1) {
              new_attending_users.push(user.name);
      
              Group.update({
                  slug : reddit_post_group_slug
              }, {
                  $set: { 
                      attending_users: new_attending_users, 
                      attending_users_count: new_attending_users.length, 
                      update_time : Date.now() 
                  }
              }, function (err, updated_group) {
                if( err ) return console.log( err );
        
                var new_is_allow_private_message;
                if (user.is_allow_private_message == false) new_is_allow_private_message = false;
                else new_is_allow_private_message = true;
                                      
                User.update({
                    name : user.name
                }, { 
                    $push: {joined_groups: group.slug},
                    $set: {is_allow_private_message: new_is_allow_private_message}
                }, function (err, updated_user) {
                  if( err ) return console.log( err );
                });
              });
            }
          });
        } else {
          r.composeMessage({
              to: comment_author_name,
              subject: "This post is not eligible to follow",
              text: '**Error!** The post **' + reddit_post_title + '** does not follow the expected formats (https://rewatchgroups.ga/about) therefore cannot be grouped and followed.  \n  \n *^^This ^^is ^^a ^^message ^^from ^^https://rewatchgroups.ga/.*'
          }).catch(function(err) {
            console.log(err);
          });
        }
      });
    }
  }
  
  function handle_mvp_comments(author_name, voter_name, reddit_post_group_slug) {
    var query_group_mvp = Group_Mvp.findOne({
        group_slug : reddit_post_group_slug, 
        reddit_name : author_name
    });
    var promise_group_mvp = query_group_mvp.exec();
    
    promise_group_mvp.then(function (group_mvp) {
      if (promise_group_mvp) {
      
        Group_Mvp.update({
            group_slug : reddit_post_group_slug, 
            reddit_name : author_name
        }, {
            $addToSet: { 
                votes: voter_name
            },
            $set: {
                update_time : Date.now() 
            }
        }, function (err, updated_group_mvp) {
          if( err ) return console.log( err );
        });
      }
    });
  }    
    
  function update_group_mvp(comment_user_name, reddit_post_group_slug, add_score, best_comment, best_comment_score, best_comment_url) {
    var query_reddit_posts = Reddit_Post.find({group_slug: reddit_post_group_slug});
    var promise_reddit_posts = query_reddit_posts.exec();

    promise_reddit_posts.then(function (reddit_posts_val) {
      if (reddit_posts_val) {
        var reddit_post_ids = [];
          
        for (i=0; i<reddit_posts_val.length; i++) {
          reddit_post_ids[i] = reddit_posts_val[i].id;
        }
          
        var query_comment_users = Reddit_Comment_User.find({reddit_name: comment_user_name, reddit_post_id: {$in: reddit_post_ids}});
        var promise_comment_users = query_comment_users.exec();

        promise_comment_users.then(function (reddit_comment_users_val) {
          if (reddit_comment_users_val) {
            var attend_count = reddit_comment_users_val.length;
              
            Group_Mvp.findOne({ 
                group_slug  : reddit_post_group_slug,
                reddit_name : comment_user_name,
            },
            function (err, group_mvp) {
              if( err ) return console.log( err );
                
              if (group_mvp) {
                var new_score_total = group_mvp.score_total + add_score;
                  
                var update_best_comment       = group_mvp.best_comment;
                var update_best_comment_score = group_mvp.best_comment_score;
                var update_best_comment_url   = group_mvp.best_comment_url;
                if (best_comment_score >= group_mvp.best_comment_score) {
                  update_best_comment       = best_comment;
                  update_best_comment_score = best_comment_score;
                  update_best_comment_url   = best_comment_url;
                }
                  
                Group_Mvp.update({
                    group_slug  : reddit_post_group_slug,
                    reddit_name : comment_user_name,
                }, {
                    $set: { 
                        score_total       : new_score_total,
                        attend_count      : attend_count,
                        best_comment      : update_best_comment,
                        best_comment_score: update_best_comment_score,
                        best_comment_url  : update_best_comment_url,
                        update_time       : Date.now() 
                    }
                }, function (err, updated_group_mvp) {
                  if( err ) return console.log( err );
                });
              } else {
                Group_Mvp.create({
                    group_slug        : reddit_post_group_slug,
                    reddit_name       : comment_user_name,
                    score_total       : add_score,
                    attend_count      : attend_count,
                    best_comment      : best_comment,
                    best_comment_score: best_comment_score,
                    best_comment_url  : best_comment_url,
                    create_time       : Date.now(),
                    update_time       : Date.now()
                }, function (err, new_group_mvp) {
                  if( err ) return console.log( err );
                });
              }
            });
          }
        });
      }
    });
  }
});

cron.schedule('23,53 * * * *', function(){ 
  //console.log('cronjob parse unread messages for [unfollow]');
    
  r.getUnreadMessages().then(function(messages){
    if (messages && messages.length > 0) {
      for (var i in messages) {
          
        if (messages[i] && typeof messages[i].body != 'undefined' && messages[i].body.toLowerCase().indexOf("[unfollow]") >= 0) {
          var title = messages[i].subject.replace(" - New post is live!", "");
          title = title.replace("re: ", "");
          var s = title.indexOf(" Rewatch by ");
          var author_name = messages[i].author.name;
          var group_name = title.substring(0, s);
          var user_name = title.substring(s + 12);
            
          var query_group = Group.findOne({name : group_name, admins: user_name});
          var promise_group = query_group.exec();
    
          promise_group.then(function (group) {
            if (group) {
              var new_attending_users = group.attending_users.slice(0);
              var user_index = new_attending_users.indexOf(author_name);
      
              if (user_index != -1) {
                new_attending_users.splice(user_index, 1);
      
                Group.update({
                    name : group_name, 
                    admins: user_name
                }, {
                    $set: { 
                        attending_users: new_attending_users, 
                        attending_users_count: new_attending_users.length, 
                        update_time : Date.now() 
                    }
                }, function (err, updated_group) {
                  if( err ) return console.log( err );
        
                  User.update({
                      name : author_name
                  }, { 
                      $pull: {joined_groups: group.slug}
                  }, function (err, updated_user) {
                    if( err ) return console.log( err );
                  });
                });
              }
            }
          });
        }
      }
      r.markMessagesAsRead(messages).catch(function(err) {
        console.log(err);
      });
    }
  }).catch(function(err) {
    console.log(err);
  });
});

cron.schedule('*/3 * * * *', function(){
  //console.log('cronjob new post private message');
    
  var query_reddit_posts = Reddit_Post.
    find({
        is_private_messaged: false,
        group_slug: { $ne: null }
    }).
    populate('group');
  var promise_reddit_posts = query_reddit_posts.exec();

  promise_reddit_posts.then(function (reddit_posts_val) {
    for (i=0; i<reddit_posts_val.length; i++) {
        
      if (reddit_posts_val[i].group) {
        var payload = {
          body:  "**" + reddit_posts_val[i].url + "**  \n  \n *^^This ^^is ^^a ^^message ^^from ^^https://rewatchgroups.ga/*  \n *^^To ^^unfollow ^^this ^^rewatch, ^^reply ^^[Unfollow] ^^to ^^this ^^message ^^or ^^visit ^^https://rewatchgroups.ga/*  \n *^^You ^^can ^^also ^^switch ^^to ^^browser ^^notifications ^^at ^^https://rewatchgroups.ga/user/settings*",
          title: reddit_posts_val[i].group.name + " Rewatch by " + reddit_posts_val[i].reddit_name + " - New post is live!"
        };    
        
        var all_users = reddit_posts_val[i].group.admins.concat(reddit_posts_val[i].group.attending_users);
        
        send_private_message_reminder(payload, all_users);
      }
    }
  });
    
  Reddit_Post.update({
      is_private_messaged: false,
      group_slug: { $ne: null }
  }, {
      $set: { 
          is_private_messaged: true,
          update_time : Date.now() 
      }
  }, {
      multi: true
  }, function (err, updated_reddit_post) {
    if( err ) return console.log( err );
  });
    
  function send_private_message_reminder(payload, all_users) {
      
    var query_user = User.find({is_allow_private_message : true, name : {$in: all_users}});
    var promise_user = query_user.exec(); 
      
    promise_user.then(function (user_val) {
      for (ii=0; ii<user_val.length; ii++) {
        r.composeMessage({
            to: user_val[ii].name,
            subject: payload.title,
            text: payload.body
        }).catch(function(err) {
          console.log(err);
        });
      }
    });
  }
});