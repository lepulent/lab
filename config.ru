#\ -p 9191

require 'rack-livereload'
require 'rack/cors'
require "./script/setup"

ENVIRONMENT = CONFIG[:environment]
puts "environment: #{ENVIRONMENT}"

use Rack::ConditionalGet
use Rack::ContentLength

Rack::Mime::MIME_TYPES.merge!({
  ".ttf" => "font/ttf",
  ".mml" => "application/xml",
  ".cml" => "application/xml",
  ".e2d" => "application/xml"
})

use Rack::Cors do
  allow do
    origins '*'
    resource '*', :headers => :any, :methods => [:get, :head]
  end
end

# see: https://github.com/johnbintz/rack-livereload
if ENVIRONMENT == 'development'
  puts "using rack-live-reload"
  map '/lab/jars/lab-sensor-applet-interface-dist' do
    # so no cache headers aren't added to the jars
    run Rack::Directory.new PUBLIC_PATH + "/lab/jars/lab-sensor-applet-interface-dist"
  end
  map '/' do
    use Rack::LiveReload
    require "rack-nocache"
    use Rack::Nocache
    use Rack::Static, :urls => [""], :root => PUBLIC_PATH , :index =>'index.html'
    run Rack::Directory.new PUBLIC_PATH
  end
else
  run Rack::Directory.new PUBLIC_PATH
end

